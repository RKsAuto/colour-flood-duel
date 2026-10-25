# Colour Flood Duel

A two-player colour flood strategy game that runs in the browser. Play a friend on one screen, or take on the computer at three difficulty levels.

## How to play

- Player 1 starts in the top-left corner, Player 2 in the bottom-right.
- On your turn, pick a colour. Your whole territory turns that colour and absorbs every touching cell of the same colour.
- You can't pick your own current colour or your rival's. Your pick also locks that colour away from them on their next turn.
- Own more than half the board to win.
- If nobody captures a cell for 3 turns each, the game ends and the bigger territory wins.
- If a player is sealed in with no open border, the other player keeps moving.
- The first move alternates every round.

**Controls:** click a colour button, press keys `1`–`6`, or click any tile on the board to pick its colour.

## Modes

| Mode | Description |
|---|---|
| vs Computer | You are Player 1. Choose Easy, Medium or Hard. |
| 2 Players | Pass-and-play on one device. |

**Computer difficulty:**

- **Easy** picks a random colour that captures something.
- **Medium** is greedy and always takes the biggest grab available.
- **Hard** looks four moves ahead with minimax and alpha-beta pruning. It scores positions by cell lead plus how much open border each side has.

In bot-vs-bot simulations on a 12 × 12 board, Medium beat Easy about 93% of the time and Hard beat Medium about 77% of the time.

## Run locally

The game has no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy on GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set the source to **Deploy from a branch**.
3. Choose the `main` branch and the `/ (root)` folder, then save.
4. After a minute the game is live at `https://<username>.github.io/<repo-name>/`.

## Files

| File | Contents |
|---|---|
| `index.html` | Page structure |
| `style.css` | Layout and theme: light and dark mode, plus a fit-to-frame layout for game portals |
| `game.js` | Game rules and the computer opponent (pure functions, no DOM) |
| `main.js` | Canvas drawing, input and UI |
| `platform.js` | Portal hooks (CrazyGames SDK). Every call is a no-op on your own site. |
| `fonts/` | Self-hosted Dela Gothic One and DM Sans (SIL Open Font License) |
| `tools/build-crazygames.py` | Builds the CrazyGames upload zip into `dist/` |
| `tools/cover.html` | Renders the store cover images |

The rules in `game.js` are exported for Node, so you can test them outside the browser:

```js
const G = require("./game.js");
const st = G.newState(12, 1);
G.playMove(st, G.chooseMove(G.cloneState(st), "hard"));
```

## CrazyGames build

```bash
python3 tools/build-crazygames.py
# -> dist/colour-flood-duel-crazygames.zip
```

The build adds the CrazyGames SDK script and switches on the fit-to-frame layout. In that build the game:

- calls `gameplayStart` / `gameplayStop` when a round starts, ends, or the rules are open
- requests a midgame ad only when you start the next round after a game ends, and carries on normally if the ad is blocked, unfilled or on cooldown
- calls `happytime` the first time you beat the Hard computer
- saves no data of its own

URL options for testing: `?embed=1` shows the portal layout on any site, and `?demo=1` makes the computer play both sides, which was used to record the trailers.
