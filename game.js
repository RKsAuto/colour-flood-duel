"use strict";

/* =========================================================
   Colour Flood Duel: game rules and computer opponent
   Pure functions on a state object, no DOM. main.js draws and
   handles input; platform.js talks to game portals.
   ========================================================= */

const COLORS = [
    { name: "Tomato", hex: "#e8553d" },
    { name: "Marigold", hex: "#f2b33d" },
    { name: "Leaf", hex: "#4fa36a" },
    { name: "Lagoon", hex: "#2f8fb8" },
    { name: "Violet", hex: "#7a5cc7" },
    { name: "Blush", hex: "#e77fb0" }
];
const P1_INK = "#f5f0e6";
const P2_INK = "#15171c";
const STALL_LIMIT = 6;   // this many moves in a row with no captures ends the game
const HARD_DEPTH = 5;    // moves the Hard computer looks ahead

// owner values
const FREE = 0, WALL = 3;
// power tiles
const BURST = 1, PRISM = 2, RAID = 3;
const PRISM_COLOR = 255;

/* ---------------------------------------------------------
   Arenas
   Walls are point-symmetric (cell r,c mirrors N-1-r, N-1-c) so
   both corners face the same board. Power tiles are placed in
   mirrored pairs too. `powers` = number of mirrored pairs.
   --------------------------------------------------------- */
function inBlocks(blocks, r, c) {
    return blocks.some(([br, bc, h, w]) => r >= br && r < br + h && c >= bc && c < bc + w);
}
const ARENAS = {
    islands: {
        name: "Islands", N: 12,
        wall: (r, c) => inBlocks([[2, 7, 2, 2], [5, 2, 2, 2], [4, 5, 2, 2]], r, c),
        powers: { [BURST]: 2, [PRISM]: 2, [RAID]: 1 }
    },
    canyon: {
        name: "Canyon", N: 13,
        // a diagonal wall with three narrow gaps
        wall: (r, c) => r + c === 12 && ![2, 6, 10].includes(r),
        powers: { [BURST]: 2, [PRISM]: 2, [RAID]: 1 }
    },
    fortress: {
        name: "Fortress", N: 14,
        // a walled 6×6 keep in the middle with one gate on each side
        wall: (r, c) => {
            const ring = (r === 4 || r === 9) && c >= 4 && c <= 9 || (c === 4 || c === 9) && r >= 4 && r <= 9;
            const gate = (r === 4 && c === 6) || (r === 9 && c === 7) || (r === 7 && c === 4) || (r === 6 && c === 9);
            return ring && !gate;
        },
        fixed: [[6, 6, BURST], [6, 7, RAID]],   // treasure inside the keep (mirrored automatically)
        powers: { [BURST]: 1, [PRISM]: 2, [RAID]: 0 }
    },
    open12: {
        name: "Open 12×12", N: 12,
        wall: () => false,
        powers: { [BURST]: 2, [PRISM]: 2, [RAID]: 1 }
    },
    open10: {
        name: "Quick 10×10", N: 10,
        wall: () => false,
        powers: { [BURST]: 1, [PRISM]: 1, [RAID]: 1 }
    }
};

/* ---------------------------------------------------------
   Board helpers
   State: { arena, N, color[], owner[], special[], pColor[_, p1, p2],
            turn, starter, moves, idle, over, note, playable, events }
   --------------------------------------------------------- */
function neighbours(i, N) {
    const r = (i / N) | 0, c = i % N, out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
}
function ring8(i, N) {
    const r = (i / N) | 0, c = i % N, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
    return out;
}
const homeOf = (st, p) => p === 1 ? 0 : st.N * st.N - 1;

// Can colour c take free cell j? Prisms match every colour.
const matches = (st, j, c) => st.color[j] === c || st.special[j] === PRISM;

// Plain colour flood without power effects. Used for setup and cheap move ordering.
function flood(st, p, c, apply) {
    const N = st.N, seen = new Uint8Array(N * N), queue = [], out = [];
    for (let i = 0; i < N * N; i++) if (st.owner[i] === p) { queue.push(i, 0); seen[i] = 1; }
    for (let h = 0; h < queue.length; h += 2) {
        const i = queue[h], d = queue[h + 1];
        for (const j of neighbours(i, N)) {
            if (!seen[j] && st.owner[j] === FREE && matches(st, j, c)) {
                seen[j] = 1;
                out.push([j, d + 1]);
                queue.push(j, d + 1);
            }
        }
    }
    if (apply) for (const [j] of out) st.owner[j] = p;
    return out;
}

// The real capture, with power tiles. Mutates st. Returns { cells: [[index, depth]], events }.
function capture(st, p, c) {
    const N = st.N, q = 3 - p, cells = [], events = [], queue = [];
    const raids = [];
    let maxD = 0;
    for (let i = 0; i < N * N; i++) if (st.owner[i] === p) queue.push(i, 0);

    function claim(j, d, source) {
        st.owner[j] = p;
        cells.push([j, d]);
        queue.push(j, d);
        if (d > maxD) maxD = d;
        if (source) source.n++;
        const sp = st.special[j];
        if (!sp) return;
        st.special[j] = 0;
        if (sp === BURST) {
            const ev = { type: "burst", at: j, d, n: 0 };
            events.push(ev);
            for (const k of ring8(j, N)) if (st.owner[k] === FREE) claim(k, d + 1, ev);
        } else if (sp === RAID) {
            const ev = { type: "raid", at: j, d, n: 0 };
            events.push(ev);
            raids.push(ev);
        }
    }

    let h = 0;
    for (;;) {
        while (h < queue.length) {
            const i = queue[h], d = queue[h + 1];
            h += 2;
            for (const j of neighbours(i, N)) {
                if (st.owner[j] === FREE && matches(st, j, c)) claim(j, d + 1, null);
            }
        }
        if (!raids.length) break;
        // Raid: take every rival cell touching your territory, except their home tile
        const ev = raids.shift();
        const home = homeOf(st, q), bite = [];
        for (let i = 0; i < N * N; i++) {
            if (st.owner[i] === q && i !== home && neighbours(i, N).some(j => st.owner[j] === p)) bite.push(i);
        }
        const d0 = maxD + 1;
        for (const j of bite) claim(j, d0, null);
        ev.n = bite.length;
    }

    for (let i = 0; i < N * N; i++) if (st.owner[i] === p) st.color[i] = c;
    return { cells, events };
}

function counts(st) {
    let a = 0, b = 0, z = 0;
    for (let i = 0; i < st.owner.length; i++) {
        const o = st.owner[i];
        if (o === 1) a++; else if (o === 2) b++; else if (o === FREE) z++;
    }
    return [a, b, z];
}

function hasFrontier(st, p) {
    const N = st.N;
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== p) continue;
        for (const j of neighbours(i, N)) if (st.owner[j] === FREE) return true;
    }
    return false;
}

function canCapture(st, p) {
    const N = st.N, blocked = st.pColor[3 - p];
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== p) continue;
        for (const j of neighbours(i, N)) {
            if (st.owner[j] === FREE && (st.color[j] !== blocked || st.special[j] === PRISM)) return true;
        }
    }
    return false;
}

function legalMoves(st, p) {
    const out = [];
    for (let c = 0; c < COLORS.length; c++) if (c !== st.pColor[1] && c !== st.pColor[2]) out.push(c);
    return out;
}
function isLegal(st, c) {
    return !st.over && c !== st.pColor[1] && c !== st.pColor[2];
}

/* ---------------------------------------------------------
   New game
   --------------------------------------------------------- */
function newState(arenaKey, starter, rnd) {
    rnd = rnd || Math.random;
    const A = ARENAS[arenaKey] || ARENAS.islands;
    const N = A.N, total = N * N;
    const color = new Uint8Array(total), owner = new Uint8Array(total), special = new Uint8Array(total);
    const mirror = i => total - 1 - i;

    for (let i = 0; i < total; i++) {
        const r = (i / N) | 0, c = i % N;
        if (A.wall(r, c, N) || A.wall(N - 1 - r, N - 1 - c, N)) owner[i] = WALL;   // always mirrored
        color[i] = (rnd() * COLORS.length) | 0;
    }
    const a = 0, b = total - 1;
    if (color[b] === color[a]) color[b] = (color[a] + 1 + ((rnd() * (COLORS.length - 1)) | 0)) % COLORS.length;

    // power tiles: fixed ones, then random mirrored pairs away from the corners and from each other
    const nearCorner = i => {
        const r = (i / N) | 0, c = i % N;
        return Math.max(r, c) <= 2 || Math.min(r, c) >= N - 3;
    };
    const free = i => owner[i] === FREE && !special[i] && !nearCorner(i) &&
        ring8(i, N).every(k => !special[k]) && i !== mirror(i);
    const place = (i, kind) => {
        special[i] = kind; special[mirror(i)] = kind;
        if (kind === PRISM) { color[i] = PRISM_COLOR; color[mirror(i)] = PRISM_COLOR; }
    };
    for (const [r, c, kind] of (A.fixed || [])) place(r * N + c, kind);
    for (const kind of [BURST, PRISM, RAID]) {
        let need = (A.powers && A.powers[kind]) || 0, tries = 0;
        while (need > 0 && tries++ < 500) {
            const i = (rnd() * total) | 0;
            if (free(i) && free(mirror(i))) { place(i, kind); need--; }
        }
    }

    const st = {
        arena: A === ARENAS[arenaKey] ? arenaKey : "islands", N, color, owner, special,
        pColor: [null, color[a], color[b]],
        turn: starter, starter, moves: 0, idle: 0, over: false, note: "", events: [],
        playable: 0
    };
    for (let i = 0; i < total; i++) if (owner[i] !== WALL) st.playable++;
    owner[a] = 1; owner[b] = 2;
    // starting patches: plain colour flood, and any power tile swept up at setup is simply removed
    for (const p of [1, 2]) for (const [j] of flood(st, p, st.pColor[p], true)) {
        if (special[j] === PRISM) color[j] = st.pColor[p];
        special[j] = 0;
    }
    for (let i = 0; i < total; i++) if (owner[i] === 1 || owner[i] === 2) color[i] = st.pColor[owner[i]];
    return st;
}

function cloneState(st) {
    return {
        arena: st.arena, N: st.N, color: st.color.slice(), owner: st.owner.slice(), special: st.special.slice(),
        pColor: st.pColor.slice(), turn: st.turn, starter: st.starter, moves: st.moves, idle: st.idle,
        over: st.over, note: st.note, events: [], playable: st.playable
    };
}

// Plays colour c for whoever's turn it is. Returns { cells, events }.
function playMove(st, c) {
    const p = st.turn;
    for (let i = 0; i < st.color.length; i++) if (st.owner[i] === p) st.color[i] = c;
    st.pColor[p] = c;
    const res = capture(st, p, c);
    st.events = res.events.map(e => Object.assign({ by: p }, e));
    st.moves++;
    st.idle = res.cells.length ? 0 : st.idle + 1;
    resolveTurn(st, p);
    return res;
}

// What colour c would do for the player to move, without changing st.
function previewMove(st, c) {
    const p = st.turn, s2 = cloneState(st);
    for (let i = 0; i < s2.color.length; i++) if (s2.owner[i] === p) s2.color[i] = c;
    const res = capture(s2, p, c);
    return { gain: res.cells.length, cells: res.cells.map(([j]) => j), events: res.events };
}

function resolveTurn(st, p) {
    const [n1, n2, n0] = counts(st);
    const half = st.playable / 2;
    st.note = "";
    if (n0 === 0 || n1 > half || n2 > half) { st.over = true; return; }
    if (st.idle >= STALL_LIMIT) { st.over = true; st.note = "stall"; return; }

    const q = 3 - p;
    const qOpen = hasFrontier(st, q), pOpen = hasFrontier(st, p);
    if (qOpen && pOpen) { st.turn = q; return; }
    if (qOpen && !pOpen) {
        if (canCapture(st, q)) st.turn = q; else st.over = true;
        return;
    }
    if (!qOpen && pOpen) {
        if (canCapture(st, p)) { st.turn = p; st.note = "sealed:" + q; } else st.over = true;
        return;
    }
    st.over = true;
}

function winner(st) {
    const [n1, n2] = counts(st);
    return n1 === n2 ? 0 : n1 > n2 ? 1 : 2;
}

/* ---------------------------------------------------------
   Computer opponent
   Easy:   random colour, preferring ones that capture something
   Medium: greedy, takes the biggest grab including power effects
   Hard:   looks 5 moves ahead (minimax with alpha-beta pruning)
   --------------------------------------------------------- */
function pick(list) { return list[(Math.random() * list.length) | 0]; }

function chooseMove(st, level) {
    const p = st.turn;
    const moves = legalMoves(st, p);
    const gains = moves.map(c => previewMove(st, c).gain);

    if (level === "easy") {
        const useful = moves.filter((c, k) => gains[k] > 0);
        return pick(useful.length ? useful : moves);
    }
    if (level === "medium") {
        const best = Math.max(...gains);
        return pick(moves.filter((c, k) => gains[k] === best));
    }

    const order = moves.map((c, k) => [c, gains[k]]).sort((x, y) => y[1] - x[1]);
    let bestScore = -Infinity, bestMoves = [];
    for (const [c] of order) {
        const s2 = cloneState(st);
        playMove(s2, c);
        const v = search(s2, HARD_DEPTH - 1, -Infinity, Infinity, p);
        if (v > bestScore + 1e-9) { bestScore = v; bestMoves = [c]; }
        else if (Math.abs(v - bestScore) < 1e-9) bestMoves.push(c);
    }
    return pick(bestMoves);
}

function search(st, depth, alpha, beta, me) {
    if (st.over || depth === 0) return evaluate(st, me);
    const p = st.turn;
    const moves = legalMoves(st, p)
        .map(c => [c, flood(st, p, c, false).length])
        .sort((x, y) => y[1] - x[1]);

    if (p === me) {
        let v = -Infinity;
        for (const [c] of moves) {
            const s2 = cloneState(st);
            playMove(s2, c);
            v = Math.max(v, search(s2, depth - 1, alpha, beta, me));
            alpha = Math.max(alpha, v);
            if (alpha >= beta) break;
        }
        return v;
    }
    let v = Infinity;
    for (const [c] of moves) {
        const s2 = cloneState(st);
        playMove(s2, c);
        v = Math.min(v, search(s2, depth - 1, alpha, beta, me));
        beta = Math.min(beta, v);
        if (alpha >= beta) break;
    }
    return v;
}

// Score from `me`'s point of view: cell lead, credit for open border, and for power tiles on that border.
function evaluate(st, me) {
    const [n1, n2] = counts(st);
    const mine = me === 1 ? n1 : n2, theirs = me === 1 ? n2 : n1;
    if (st.over) {
        if (mine === theirs) return 0;
        return (mine > theirs ? 1000 : -1000) + (mine - theirs);
    }
    const N = st.N;
    let edge = 0;
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== FREE) continue;
        let touchMe = false, touchThem = false;
        for (const j of neighbours(i, N)) {
            if (st.owner[j] === me) touchMe = true;
            else if (st.owner[j] === 3 - me) touchThem = true;
        }
        const w = st.special[i] ? 2.5 : 1;
        if (touchMe) edge += w;
        if (touchThem) edge -= w;
    }
    return (mine - theirs) + 0.35 * edge;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        COLORS, ARENAS, FREE, WALL, BURST, PRISM, RAID, newState, cloneState, playMove, previewMove,
        legalMoves, isLegal, chooseMove, counts, winner, flood, hasFrontier
    };
}
