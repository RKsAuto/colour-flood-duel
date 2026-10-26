"use strict";

/* =========================================================
   Platform adapter
   The game talks only to `Platform`. On your own website every
   call is a harmless no-op. When the CrazyGames SDK script is on
   the page (the portal build adds it), calls go to the SDK.
   ========================================================= */

const Platform = (function () {
    let sdk = null;          // CrazyGames SDK once initialised
    let playing = false;     // avoids duplicate gameplayStart/Stop calls
    let adBusy = false;
    let happyUsed = false;

    async function init() {
        const cg = window.CrazyGames && window.CrazyGames.SDK;
        if (!cg) return;
        try {
            await cg.init();
            if (cg.environment === "crazygames" || cg.environment === "local") sdk = cg;
            console.info(`[Colour Flood Duel] CrazyGames SDK ready, environment: ${cg.environment}`);
        } catch (e) {
            console.warn("CrazyGames SDK init failed, running without it", e);
        }
    }

    function call(fn) {
        if (!sdk) return;
        try { fn(sdk); } catch (e) { console.warn("SDK call failed", e); }
    }

    return {
        init,
        get name() { return sdk ? "crazygames" : "web"; },
        get adBusy() { return adBusy; },

        loadingStart() { call(s => s.game.loadingStart()); },
        loadingStop() { call(s => s.game.loadingStop()); },

        gameplayStart() {
            if (playing) return;
            playing = true;
            call(s => s.game.gameplayStart());
        },
        gameplayStop() {
            if (!playing) return;
            playing = false;
            call(s => s.game.gameplayStop());
        },

        // For big moments only (beating the Hard computer). Fires once per session.
        happytime() {
            if (happyUsed) return;
            happyUsed = true;
            call(s => s.game.happytime());
        },

        // Midgame ad at a natural break. Always resolves, ad or no ad,
        // so the game carries on if ads are blocked, unfilled or on cooldown.
        midgameAd() {
            const tag = "[Colour Flood Duel]";
            if (!sdk) { console.info(`${tag} no ad: CrazyGames SDK not active`); return Promise.resolve(); }
            if (adBusy) return Promise.resolve();
            adBusy = true;
            console.info(`${tag} requesting midgame ad`);
            return new Promise(resolve => {
                const done = () => { adBusy = false; resolve(); };
                try {
                    sdk.ad.requestAd("midgame", {
                        adStarted: () => console.info(`${tag} midgame ad started`),
                        adFinished: () => { console.info(`${tag} midgame ad finished`); done(); },
                        // codes: adsDisabledBasicLaunch, unfilled, adblock, adCooldown, other
                        adError: e => { console.info(`${tag} midgame ad not shown:`, (e && (e.code || e.message)) || e); done(); }
                    });
                } catch (e) {
                    console.info(`${tag} midgame ad request failed:`, e);
                    done();
                }
            });
        },

        // Settings persistence: browser storage on the web. On portals
        // we skip it, because they ask games to save only through their SDK.
        load(key) {
            if (sdk) return null;
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        save(key, value) {
            if (sdk) return;
            try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
        }
    };
})();
