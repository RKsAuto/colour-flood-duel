"use strict";

/* =========================================================
   Colour Flood Duel: drawing and UI
   Uses the rules in game.js and the portal hooks in platform.js.
   ?demo=1 makes the computer play both sides (for trailers).
   ========================================================= */

(function () {
    const $ = id => document.getElementById(id);
    const cv = $("board");
    const ctx = cv.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const params = new URLSearchParams(location.search);
    const DEMO = params.get("demo") === "1";
    const CPU_DELAY = DEMO ? 380 : 650;

    const ui = { mode: "cpu", level: "medium", N: 12 };
    let S = null;              // current game
    let series = { 1: 0, 2: 0, draws: 0 };
    let nextStarter = 1;
    let gameId = 0;            // invalidates pending computer moves when a new game starts
    let thinking = false;
    let recorded = false;
    let modalOpen = false;
    let anim = null, preview = null, hoverColor = null;

    /* ----- helpers ----- */
    const names = () => ui.mode === "cpu" ? { 1: "You", 2: "Computer" } : { 1: "Player 1", 2: "Player 2" };
    const isCpuTurn = () => S && !S.over && (DEMO || (ui.mode === "cpu" && S.turn === 2));
    const blocked = () => modalOpen || Platform.adBusy;
    const humanCanMove = () => S && !S.over && !thinking && !isCpuTurn() && !blocked();

    function loadPrefs() {
        try {
            const p = JSON.parse(Platform.load("cfd-prefs") || "{}");
            if (p.mode === "cpu" || p.mode === "pvp") ui.mode = p.mode;
            if (["easy", "medium", "hard"].includes(p.level)) ui.level = p.level;
            if ([10, 12, 14].includes(p.N)) ui.N = p.N;
        } catch (e) { /* ignore bad data */ }
        if (DEMO) { ui.mode = "cpu"; ui.level = "hard"; }
    }
    const savePrefs = () => Platform.save("cfd-prefs", JSON.stringify(ui));

    /* ----- game flow ----- */
    function startGame() {
        gameId++;
        thinking = false;
        recorded = false;
        S = newState(ui.N, nextStarter);
        nextStarter = 3 - nextStarter;
        anim = null; preview = null; hoverColor = null;
        render();
        if (!modalOpen) Platform.gameplayStart();
        maybeCpuMove();
    }

    // Between rounds is the natural break for an ad. If there is no ad
    // (own website, ad blocker, cooldown) the next round starts straight away.
    async function nextRound() {
        if (Platform.adBusy) return;
        if (S && S.over) {
            $("againBtn").disabled = true;
            await Platform.midgameAd();
            $("againBtn").disabled = false;
        }
        startGame();
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
            Platform.gameplayStop();
            if (!DEMO && ui.mode === "cpu" && ui.level === "hard" && w === 1) Platform.happytime();
            if (DEMO) setTimeout(startGame, 2200);
        }
        render();
        maybeCpuMove();
    }

    function maybeCpuMove() {
        if (!isCpuTurn() || blocked()) return;
        thinking = true;
        render();
        const id = gameId;
        setTimeout(() => {
            if (id !== gameId) return;
            if (blocked()) { thinking = false; return; }   // resumes when the modal closes
            const level = DEMO ? (S.turn === 1 ? "hard" : "medium") : ui.level;
            const c = chooseMove(cloneState(S), level);
            thinking = false;
            applyMove(c);
        }, CPU_DELAY);
    }

    /* ----- rules modal ----- */
    $("rulesModalList").innerHTML = $("rulesList").innerHTML;
    function openRules() {
        modalOpen = true;
        $("rulesModal").hidden = false;
        Platform.gameplayStop();
        $("rulesClose").focus();
    }
    function closeRules() {
        modalOpen = false;
        $("rulesModal").hidden = true;
        if (S && !S.over) Platform.gameplayStart();
        render();
        maybeCpuMove();
    }
    $("rulesBtn").addEventListener("click", openRules);
    $("rulesClose").addEventListener("click", closeRules);
    $("rulesModal").addEventListener("click", e => { if (e.target === $("rulesModal")) closeRules(); });

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
        const nm = DEMO ? { 1: "Hard bot", 2: "Medium bot" } : names();
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
        const cpu = isCpuTurn();
        if (S.over) st.textContent = "Game over";
        else if (cpu) st.innerHTML = `<span class="chip p${S.turn}">${S.turn}</span> ${DEMO ? nm[S.turn] : "Computer"} is thinking <span class="dots"><i></i><i></i><i></i></span>`;
        else if (ui.mode === "cpu") st.innerHTML = `<span class="chip p1">1</span> Your turn, pick a colour`;
        else st.innerHTML = `<span class="chip p${S.turn}">${S.turn}</span> ${nm[S.turn]}, pick a colour`;

        // note line
        let note = "";
        if (S.note.startsWith("sealed:")) {
            const q = Number(S.note.slice(7));
            const you = ui.mode === "cpu" && !DEMO;
            note = `${nm[q]} ${you && q === 1 ? "are" : "is"} sealed in, so ${nm[3 - q]} ${you && q === 2 ? "go" : "goes"} again.`;
        } else if (S.moves === 0 && !DEMO) {
            note = ui.mode === "cpu"
                ? (S.starter === 1 ? "You move first this round." : "The computer moves first this round.")
                : `${nm[S.starter]} moves first this round.`;
        }
        $("note").hidden = !note;
        $("note").textContent = note;

        // colour buttons
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
        if (S.over && !DEMO) {
            const w = winner(S), wn = Math.max(n1, n2), ln = Math.min(n1, n2);
            let title;
            if (w === 0) title = "It's a draw";
            else if (ui.mode === "cpu") title = w === 1 ? "You win!" : "Computer wins";
            else title = `${nm[w]} wins`;
            const levelTxt = ui.mode === "cpu" ? ` on ${ui.level[0].toUpperCase() + ui.level.slice(1)}` : "";
            const stallTxt = S.note === "stall" ? "Board locked up with no captures for 3 turns each. " : "";
            $("resTitle").textContent = title;
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
        if (!S) return;
        const i = cellAt(ev);
        if (i >= 0) humanMove(S.color[i]);
    });
    cv.addEventListener("mousemove", ev => {
        if (!S) return;
        const i = cellAt(ev);
        const c = i >= 0 ? S.color[i] : null;
        if (c !== hoverColor) setPreview(c);
    });
    cv.addEventListener("mouseleave", () => setPreview(null));

    document.addEventListener("keydown", ev => {
        if (modalOpen && ev.key === "Escape") { closeRules(); return; }
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
    $("newBtn").addEventListener("click", nextRound);
    $("againBtn").addEventListener("click", nextRound);

    if (window.ResizeObserver) new ResizeObserver(() => { if (!anim) draw(); }).observe(cv);
    else window.addEventListener("resize", () => draw());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());

    /* ----- boot ----- */
    (async function boot() {
        await Platform.init();
        Platform.loadingStart();
        loadPrefs();
        syncControls();
        Platform.loadingStop();
        startGame();
    })();
})();
