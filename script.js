"use strict";

/* =========================================================
   Colour Flood Duel
   1. Game rules (pure functions on a state object)
   2. Computer opponent (Easy / Medium / Hard)
   3. Drawing the board
   4. UI wiring
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
    module.exports = { COLORS, newState, cloneState, playMove, legalMoves, chooseMove, counts, winner, flood, hasFrontier };
}

/* ---------------------------------------------------------
   3 + 4. Drawing and UI (browser only)
   --------------------------------------------------------- */
if (typeof document !== "undefined") (function () {
    const $ = id => document.getElementById(id);
    const cv = $("board");
    const ctx = cv.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const CPU_DELAY = 650;

    const ui = { mode: "cpu", level: "medium", N: 12 };
    let S = null;              // current game
    let series = { 1: 0, 2: 0, draws: 0 };
    let nextStarter = 1;
    let gameId = 0;            // invalidates pending computer moves when a new game starts
    let thinking = false;
    let recorded = false;
    let anim = null, preview = null, hoverColor = null;

    /* ----- helpers ----- */
    const names = () => ui.mode === "cpu" ? { 1: "You", 2: "Computer" } : { 1: "Player 1", 2: "Player 2" };
    const isCpuTurn = () => ui.mode === "cpu" && S && !S.over && S.turn === 2;
    const humanCanMove = () => S && !S.over && !thinking && !isCpuTurn();

    function loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem("cfd-prefs") || "{}");
            if (p.mode === "cpu" || p.mode === "pvp") ui.mode = p.mode;
            if (["easy", "medium", "hard"].includes(p.level)) ui.level = p.level;
            if ([10, 12, 14].includes(p.N)) ui.N = p.N;
        } catch (e) { /* storage unavailable */ }
    }
    function savePrefs() {
        try { localStorage.setItem("cfd-prefs", JSON.stringify(ui)); } catch (e) { /* ignore */ }
    }

    /* ----- game flow ----- */
    function startGame() {
        gameId++;
        thinking = false;
        recorded = false;
        S = newState(ui.N, nextStarter);
        nextStarter = 3 - nextStarter;
        anim = null; preview = null; hoverColor = null;
        render();
        maybeCpuMove();
    }

    function resetSeries() {
        series = { 1: 0, 2: 0, draws: 0 };
        nextStarter = 1;
    }

    function humanMove(c) {
        if (!humanCanMove() || !isLegal(S, c)) return;
        applyMove(c);
    }

    function applyMove(c) {
        const got = playMove(S, c);
        preview = null; hoverColor = null;
        startAnim(got);
        if (S.over && !recorded) {
            recorded = true;
            const w = winner(S);
            if (w === 0) series.draws++; else series[w]++;
        }
        render();
        maybeCpuMove();
    }

    function maybeCpuMove() {
        if (!isCpuTurn()) return;
        thinking = true;
        render();
        const id = gameId;
        setTimeout(() => {
            if (id !== gameId) return;
            const c = chooseMove(cloneState(S), ui.level);
            thinking = false;
            if (id !== gameId) return;
            applyMove(c);
        }, CPU_DELAY);
    }

    /* ----- animation ----- */
    function startAnim(got) {
        if (reduceMotion || !got.length) { anim = null; return; }
        const delays = new Map();
        let maxD = 0;
        for (const [j, d] of got) {
            const ms = Math.min(d, 24) * 26;
            delays.set(j, ms);
            if (ms > maxD) maxD = ms;
        }
        anim = { t0: performance.now(), delays, end: maxD + 260 };
        requestAnimationFrame(tick);
    }
    function tick(now) {
        if (!anim) return;
        draw(now);
        if (now - anim.t0 < anim.end) requestAnimationFrame(tick);
        else { anim = null; draw(); }
    }
    const ease = t => 1 - Math.pow(1 - t, 3);

    /* ----- drawing ----- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
        ctx.fill();
    }

    function draw(now) {
        if (!S) return;
        const W = cv.getBoundingClientRect().width;
        if (!W) return;
        const dpr = window.devicePixelRatio || 1;
        const px = Math.round(W * dpr);
        if (cv.width !== px) { cv.width = px; cv.height = px; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, W);

        const N = S.N, s = W / N, gap = Math.max(1.5, s * 0.1);
        const t = anim && now ? now - anim.t0 : null;

        // cells: unclaimed cells are rounded tiles, claimed cells melt into a solid patch
        for (let i = 0; i < N * N; i++) {
            const x = (i % N) * s, y = ((i / N) | 0) * s;
            let k = S.owner[i] ? 1 : 0;
            if (k && t !== null && anim.delays.has(i)) {
                k = ease(Math.max(0, Math.min(1, (t - anim.delays.get(i)) / 240)));
            }
            ctx.fillStyle = COLORS[S.color[i]].hex;
            if (k >= 1) ctx.fillRect(x - 0.3, y - 0.3, s + 0.6, s + 0.6);
            else {
                const inset = (gap / 2) * (1 - k);
                roundRect(x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.24 * (1 - k));
            }
        }

        // preview dots on the cells the hovered colour would grab
        if (preview && preview.size) {
            for (const i of preview) {
                const c = i % N, r = (i / N) | 0;
                ctx.fillStyle = "rgba(255,255,255,0.22)";
                roundRect(c * s + gap / 2, r * s + gap / 2, s - gap, s - gap, s * 0.24);
                ctx.fillStyle = S.turn === 1 ? P1_INK : P2_INK;
                ctx.beginPath();
                ctx.arc(c * s + s / 2, r * s + s / 2, Math.max(2, s * 0.13), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // territory outlines
        const lw = Math.max(2, s * 0.11), h = lw / 2;
        ctx.lineWidth = lw;
        ctx.lineCap = "square";
        for (const p of [1, 2]) {
            ctx.strokeStyle = p === 1 ? P1_INK : P2_INK;
            ctx.beginPath();
            for (let i = 0; i < N * N; i++) {
                if (S.owner[i] !== p) continue;
                const r = (i / N) | 0, c = i % N, x = c * s, y = r * s;
                if (r === 0 || S.owner[i - N] !== p) { ctx.moveTo(x, y + h); ctx.lineTo(x + s, y + h); }
                if (r === N - 1 || S.owner[i + N] !== p) { ctx.moveTo(x, y + s - h); ctx.lineTo(x + s, y + s - h); }
                if (c === 0 || S.owner[i - 1] !== p) { ctx.moveTo(x + h, y); ctx.lineTo(x + h, y + s); }
                if (c === N - 1 || S.owner[i + 1] !== p) { ctx.moveTo(x + s - h, y); ctx.lineTo(x + s - h, y + s); }
            }
            ctx.stroke();
        }

        // home badges
        const br = Math.min(s * 0.32, 14);
        if (br >= 6) {
            [[0, 1], [N * N - 1, 2]].forEach(([i, p]) => {
                const cx = (i % N) * s + s / 2, cy = ((i / N) | 0) * s + s / 2;
                ctx.fillStyle = p === 1 ? P1_INK : P2_INK;
                ctx.beginPath();
                ctx.arc(cx, cy, br, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p === 1 ? P2_INK : P1_INK;
                ctx.font = `${Math.round(br * 1.1)}px "Dela Gothic One", "Arial Black", sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(p), cx, cy + 1);
            });
        }
    }

    /* ----- side panel ----- */
    const palette = $("palette");
    COLORS.forEach((col, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sw";
        b.id = "sw" + i;
        b.dataset.c = i;
        b.innerHTML = `<span class="blob" style="--c:${col.hex}"><span class="key">${i + 1}</span></span><span class="gain"></span>`;
        b.addEventListener("click", () => humanMove(i));
        b.addEventListener("mouseenter", () => setPreview(i));
        b.addEventListener("focus", () => setPreview(i));
        b.addEventListener("mouseleave", () => setPreview(null));
        b.addEventListener("blur", () => setPreview(null));
        palette.appendChild(b);
    });

    function setPreview(c) {
        if (c === null || !humanCanMove() || !isLegal(S, c)) { preview = null; hoverColor = null; }
        else { hoverColor = c; preview = new Set(flood(S, S.turn, c, false).map(([j]) => j)); }
        document.querySelectorAll(".sw").forEach(b => b.classList.toggle("hot", Number(b.dataset.c) === hoverColor));
        if (!anim) draw();
    }

    function render() {
        const nm = names();
        const [n1, n2, n0] = counts(S);
        const total = S.N * S.N;

        $("n1").textContent = nm[1];
        $("n2").textContent = nm[2];
        $("w1").textContent = series[1];
        $("w2").textContent = series[2];
        $("s1").textContent = n1;
        $("s2").textContent = n2;
        $("t1").style.width = (n1 / total * 100) + "%";
        $("t0").style.width = (n0 / total * 100) + "%";
        $("t2").style.width = (n2 / total * 100) + "%";
        $("pct1").textContent = Math.round(n1 / total * 100) + "%";
        $("pct2").textContent = Math.round(n2 / total * 100) + "%";
        $("movesTxt").textContent = S.over
            ? `${S.moves} moves`
            : `Move ${S.moves + 1} · need ${Math.floor(total / 2) + 1}`;
        $("pc1").classList.toggle("active", !S.over && S.turn === 1);
        $("pc2").classList.toggle("active", !S.over && S.turn === 2);
        document.querySelector(".board-wrap").classList.toggle("waiting", isCpuTurn());

        // status line
        const st = $("status");
        if (S.over) st.textContent = "Game over";
        else if (isCpuTurn()) st.innerHTML = `<span class="chip p2">2</span> Computer is thinking <span class="dots"><i></i><i></i><i></i></span>`;
        else if (ui.mode === "cpu") st.innerHTML = `<span class="chip p1">1</span> Your turn, pick a colour`;
        else st.innerHTML = `<span class="chip p${S.turn}">${S.turn}</span> ${nm[S.turn]}, pick a colour`;

        // note line
        let note = "";
        if (S.note.startsWith("sealed:")) {
            const q = Number(S.note.slice(7));
            note = `${nm[q]} ${ui.mode === "cpu" && q === 1 ? "are" : "is"} sealed in, so ${nm[3 - q]} ${ui.mode === "cpu" && q === 2 ? "go" : "goes"} again.`;
        } else if (S.moves === 0) {
            note = ui.mode === "cpu"
                ? (S.starter === 1 ? "You move first this round." : "The computer moves first this round.")
                : `${nm[S.starter]} moves first this round.`;
        }
        $("note").hidden = !note;
        $("note").textContent = note;

        // colour buttons
        const cpu = isCpuTurn();
        COLORS.forEach((col, i) => {
            const b = $("sw" + i), gainEl = b.querySelector(".gain");
            b.disabled = cpu || !isLegal(S, i);
            b.classList.toggle("wait", cpu);
            if (S.over || cpu) { gainEl.textContent = "–"; b.setAttribute("aria-label", col.name); }
            else if (i === S.pColor[S.turn]) { gainEl.textContent = "Yours"; b.setAttribute("aria-label", `${col.name}, your current colour`); }
            else if (i === S.pColor[3 - S.turn]) { gainEl.textContent = "Rival"; b.setAttribute("aria-label", `${col.name}, your rival's colour`); }
            else {
                const g = flood(S, S.turn, i, false).length;
                gainEl.textContent = "+" + g;
                b.setAttribute("aria-label", `${col.name}, grabs ${g} cells`);
            }
        });

        // result card
        const ov = $("overlay");
        if (S.over) {
            const w = winner(S), wn = Math.max(n1, n2), ln = Math.min(n1, n2);
            let title;
            if (w === 0) title = "It's a draw";
            else if (ui.mode === "cpu") title = w === 1 ? "You win!" : "Computer wins";
            else title = `${nm[w]} wins`;
            const levelTxt = ui.mode === "cpu" ? ` on ${ui.level[0].toUpperCase() + ui.level.slice(1)}` : "";
            $("resTitle").textContent = title;
            const stallTxt = S.note === "stall" ? "Board locked up with no captures for 3 turns each. " : "";
            $("resSub").textContent = stallTxt + (w === 0
                ? `${n1} cells each after ${S.moves} moves.`
                : `${wn} to ${ln} in ${S.moves} moves${levelTxt}. Series ${series[1]}–${series[2]}.`);
            ov.hidden = false;
        } else ov.hidden = true;

        if (!anim) draw();
    }

    function syncControls() {
        $("modeCpu").setAttribute("aria-pressed", String(ui.mode === "cpu"));
        $("modePvp").setAttribute("aria-pressed", String(ui.mode === "pvp"));
        $("levelField").hidden = ui.mode !== "cpu";
        $("level").value = ui.level;
        $("size").value = String(ui.N);
    }

    /* ----- input ----- */
    function cellAt(ev) {
        const rect = cv.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return -1;
        const s = rect.width / S.N;
        return Math.floor(y / s) * S.N + Math.floor(x / s);
    }
    cv.addEventListener("click", ev => {
        const i = cellAt(ev);
        if (i >= 0) humanMove(S.color[i]);
    });
    cv.addEventListener("mousemove", ev => {
        const i = cellAt(ev);
        const c = i >= 0 ? S.color[i] : null;
        if (c !== hoverColor) setPreview(c);
    });
    cv.addEventListener("mouseleave", () => setPreview(null));

    document.addEventListener("keydown", ev => {
        if (ev.target.tagName === "SELECT" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const n = Number(ev.key);
        if (n >= 1 && n <= COLORS.length) humanMove(n - 1);
    });

    function changeSettings(patch) {
        Object.assign(ui, patch);
        savePrefs();
        syncControls();
        resetSeries();
        startGame();
    }
    $("modeCpu").addEventListener("click", () => { if (ui.mode !== "cpu") changeSettings({ mode: "cpu" }); });
    $("modePvp").addEventListener("click", () => { if (ui.mode !== "pvp") changeSettings({ mode: "pvp" }); });
    $("level").addEventListener("change", e => changeSettings({ level: e.target.value }));
    $("size").addEventListener("change", e => changeSettings({ N: Number(e.target.value) }));
    $("newBtn").addEventListener("click", startGame);
    $("againBtn").addEventListener("click", startGame);

    if (window.ResizeObserver) new ResizeObserver(() => { if (!anim) draw(); }).observe(cv);
    else window.addEventListener("resize", () => draw());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());

    loadPrefs();
    syncControls();
    startGame();
})();
