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
const STALL_LIMIT = 6; // this many moves in a row with no captures ends the game

/* ---------------------------------------------------------
   1. Game rules
   State: { N, color[], owner[], pColor[_, p1, p2], turn, starter, moves, over, note }
   owner: 0 = unclaimed, 1 = player 1, 2 = player 2
   --------------------------------------------------------- */

function neighbours(i, N) {
    const r = (i / N) | 0, c = i % N, out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
}

// Returns the cells player p would absorb by switching to colour c, as [index, depth] pairs.
// With apply = true it also claims them.
function flood(st, p, c, apply) {
    const N = st.N, seen = new Uint8Array(N * N), queue = [], out = [];
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] === p) { queue.push(i, 0); seen[i] = 1; }
    }
    for (let h = 0; h < queue.length; h += 2) {
        const i = queue[h], d = queue[h + 1];
        for (const j of neighbours(i, N)) {
            if (!seen[j] && st.owner[j] === 0 && st.color[j] === c) {
                seen[j] = 1;
                out.push([j, d + 1]);
                queue.push(j, d + 1);
            }
        }
    }
    if (apply) for (const [j] of out) st.owner[j] = p;
    return out;
}

function counts(st) {
    let a = 0, b = 0, z = 0;
    for (let i = 0; i < st.owner.length; i++) {
        const o = st.owner[i];
        if (o === 1) a++; else if (o === 2) b++; else z++;
    }
    return [a, b, z];
}

// Does player p touch any unclaimed cell?
function hasFrontier(st, p) {
    const N = st.N;
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== p) continue;
        for (const j of neighbours(i, N)) if (st.owner[j] === 0) return true;
    }
    return false;
}

// Can player p capture anything this turn? (Neighbouring cells in the rival's colour are off limits.)
function canCapture(st, p) {
    const N = st.N, blocked = st.pColor[3 - p];
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== p) continue;
        for (const j of neighbours(i, N)) {
            if (st.owner[j] === 0 && st.color[j] !== blocked) return true;
        }
    }
    return false;
}

function legalMoves(st, p) {
    const out = [];
    for (let c = 0; c < COLORS.length; c++) {
        if (c !== st.pColor[1] && c !== st.pColor[2]) out.push(c);
    }
    return out;
}

function isLegal(st, c) {
    return !st.over && c !== st.pColor[1] && c !== st.pColor[2];
}

function newState(N, starter) {
    const color = new Uint8Array(N * N);
    for (let i = 0; i < color.length; i++) color[i] = (Math.random() * COLORS.length) | 0;
    const a = 0, b = N * N - 1;
    if (color[b] === color[a]) {
        color[b] = (color[a] + 1 + ((Math.random() * (COLORS.length - 1)) | 0)) % COLORS.length;
    }
    const st = {
        N, color, owner: new Uint8Array(N * N),
        pColor: [null, color[a], color[b]],
        turn: starter, starter, moves: 0, idle: 0, over: false, note: ""
    };
    st.owner[a] = 1;
    st.owner[b] = 2;
    flood(st, 1, color[a], true);
    flood(st, 2, color[b], true);
    return st;
}

function cloneState(st) {
    return {
        N: st.N, color: st.color.slice(), owner: st.owner.slice(), pColor: st.pColor.slice(),
        turn: st.turn, starter: st.starter, moves: st.moves, idle: st.idle, over: st.over, note: st.note
    };
}

// Plays colour c for whoever's turn it is. Returns the captured cells.
function playMove(st, c) {
    const p = st.turn;
    for (let i = 0; i < st.color.length; i++) if (st.owner[i] === p) st.color[i] = c;
    st.pColor[p] = c;
    const got = flood(st, p, c, true);
    st.moves++;
    st.idle = got.length ? 0 : st.idle + 1;
    resolveTurn(st, p);
    return got;
}

// Decides what happens after player p moved: game over, next player's turn, or p again.
function resolveTurn(st, p) {
    const [n1, n2, n0] = counts(st);
    const half = (st.N * st.N) / 2;
    st.note = "";
    if (n0 === 0 || n1 > half || n2 > half) { st.over = true; return; }
    if (st.idle >= STALL_LIMIT) { st.over = true; st.note = "stall"; return; }

    const q = 3 - p;
    const qOpen = hasFrontier(st, q), pOpen = hasFrontier(st, p);
    if (qOpen && pOpen) { st.turn = q; return; }
    if (qOpen && !pOpen) {
        // p is sealed in, q plays on alone while there is something left to take
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
   2. Computer opponent
   Easy:   random colour, preferring ones that capture something
   Medium: greedy, takes the biggest grab right now
   Hard:   looks 4 moves ahead (minimax with alpha-beta pruning)
   --------------------------------------------------------- */

function pick(list) { return list[(Math.random() * list.length) | 0]; }

function chooseMove(st, level) {
    const p = st.turn;
    const moves = legalMoves(st, p);
    const gains = moves.map(c => flood(st, p, c, false).length);

    if (level === "easy") {
        const useful = moves.filter((c, k) => gains[k] > 0);
        return pick(useful.length ? useful : moves);
    }

    if (level === "medium") {
        const best = Math.max(...gains);
        return pick(moves.filter((c, k) => gains[k] === best));
    }

    // hard
    const order = moves.map((c, k) => [c, gains[k]]).sort((x, y) => y[1] - x[1]);
    let bestScore = -Infinity, bestMoves = [];
    for (const [c] of order) {
        const s2 = cloneState(st);
        playMove(s2, c);
        const v = search(s2, 3, -Infinity, Infinity, p);
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

// Score from `me`'s point of view: cell lead, plus a little credit for how much open border each side has.
function evaluate(st, me) {
    const [n1, n2] = counts(st);
    const mine = me === 1 ? n1 : n2, theirs = me === 1 ? n2 : n1;
    if (st.over) {
        if (mine === theirs) return 0;
        return (mine > theirs ? 1000 : -1000) + (mine - theirs);
    }
    const N = st.N;
    let myEdge = 0, theirEdge = 0;
    for (let i = 0; i < N * N; i++) {
        if (st.owner[i] !== 0) continue;
        let touchMe = false, touchThem = false;
        for (const j of neighbours(i, N)) {
            if (st.owner[j] === me) touchMe = true;
            else if (st.owner[j] === 3 - me) touchThem = true;
        }
        if (touchMe) myEdge++;
        if (touchThem) theirEdge++;
    }
    return (mine - theirs) + 0.35 * (myEdge - theirEdge);
}

/* ---------------------------------------------------------
   Node export so the rules can be tested outside the browser
   --------------------------------------------------------- */
if (typeof module !== "undefined" && module.exports) {
    module.exports = { COLORS, newState, cloneState, playMove, legalMoves, isLegal, chooseMove, counts, winner, flood, hasFrontier };
}
