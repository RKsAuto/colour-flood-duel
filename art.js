"use strict";

/* =========================================================
   Tile artwork shared by the game board, the legend and the
   store covers. Every function draws into a 2D canvas context
   at cell position (x, y) with cell size s.
   ========================================================= */

const Art = (function () {
    const CREAM = "#f5f0e6", INK = "#15171c";
    const PRISM_BANDS = ["#e8553d", "#f2b33d", "#2f8fb8", "#7a5cc7"];

    function rounded(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    }

    // A recessed gap in the board
    function wall(ctx, x, y, s) {
        const g = Math.max(1.5, s * 0.1);
        ctx.save();
        rounded(ctx, x + g / 2, y + g / 2, s - g, s - g, s * 0.2);
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = Math.max(1, s * 0.06);
        for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(x + s * (0.2 + 0.35 * k), y + s);
            ctx.lineTo(x + s * (0.8 + 0.35 * k), y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // A tile that matches every colour: four colour bands and a light core
    function prism(ctx, x, y, s, inset, radius) {
        const cx = x + s / 2, cy = y + s / 2;
        ctx.save();
        rounded(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, radius);
        ctx.clip();
        const corners = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
        for (let k = 0; k < 4; k++) {
            const a = corners[k], b = corners[(k + 1) % 4];
            ctx.beginPath();
            ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
            ctx.closePath();
            ctx.fillStyle = PRISM_BANDS[k];
            ctx.fill();
        }
        ctx.beginPath();
        const d = s * 0.2;
        ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy);
        ctx.closePath();
        ctx.fillStyle = CREAM;
        ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.restore();
    }

    // Eight-point starburst
    function burst(ctx, x, y, s) {
        const cx = x + s / 2, cy = y + s / 2, R = s * 0.33, r = s * 0.15;
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 8, rad = k % 2 ? r : R;
            const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
            if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1.2, s * 0.07);
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = CREAM;
        ctx.fill();
    }

    // Lightning bolt
    function raid(ctx, x, y, s) {
        const cx = x + s / 2, cy = y + s / 2, k = s * 0.78;
        const pts = [[0.10, -0.44], [-0.22, 0.05], [-0.02, 0.05], [-0.12, 0.44], [0.24, -0.07], [0.04, -0.07]];
        ctx.beginPath();
        pts.forEach(([px, py], n) => {
            const X = cx + px * k, Y = cy + py * k;
            if (n) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        });
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1.2, s * 0.07);
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = CREAM;
        ctx.fill();
    }

    // Small standalone icon for the legend: a coloured tile with the symbol on it.
    // Drawn off-screen and shown as an <img>, so the game board stays the page's only canvas.
    function legendIcon(img, kind) {
        const dpr = Math.max(2, window.devicePixelRatio || 1), css = img.clientWidth || 22;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = Math.round(css * dpr);
        const ctx = canvas.getContext("2d");
        draw(ctx, kind, css, dpr);
        img.src = canvas.toDataURL("image/png");
    }
    function draw(ctx, kind, css, dpr) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const s = css, inset = 0, rad = s * 0.24;
        if (kind === "prism") { prism(ctx, 0, 0, s, inset, rad); return; }
        if (kind === "wall") {
            rounded(ctx, 0, 0, s, s, rad); ctx.fillStyle = "#262a33"; ctx.fill();
            wall(ctx, 0, 0, s); return;
        }
        rounded(ctx, 0, 0, s, s, rad);
        ctx.fillStyle = kind === "burst" ? "#e8553d" : "#2f8fb8";
        ctx.fill();
        (kind === "burst" ? burst : raid)(ctx, 0, 0, s);
    }

    return { wall, prism, burst, raid, legendIcon, rounded };
})();
