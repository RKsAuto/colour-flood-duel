# Colour Flood Duel

A two-player territory battle that runs in the browser. Flood your colour across walled arenas, set off Bursts, bridge with Prisms and Raid your rival's border. Play a friend on one screen, or take on the computer at three difficulty levels.

## How to play

- Player 1 starts in the top-left corner, Player 2 in the bottom-right.
- On your turn, pick a colour. Your whole territory turns that colour and absorbs every touching tile of the same colour.
- You can't pick your own current colour or your rival's. Your pick also locks that colour away from them on their next turn.
- Own more than half the playable tiles to win.
- If nobody captures a tile for 3 turns each, the game ends and the bigger territory wins.
- If a player is sealed in with no open border, the other player keeps moving.
- The first move alternates every round.

**Power tiles**

| Tile | Effect |
|---|---|
| **Burst** (starburst) | Capturing it blasts open the 8 tiles around it, whatever their colour. Bursts can chain. |
| **Prism** (four-colour tile) | Matches every colour, so any flood that touches it takes it. Useful as a bridge. |
| **Raid** (lightning bolt) | Capturing it steals every rival tile touching your border. Home corners can't be stolen. |

**Arenas**

| Arena | Size | Layout |
|---|---|---|
| Islands | 12 × 12 | Wall blocks that split the board into lanes |
| Canyon | 13 × 13 | A diagonal wall with three narrow gaps |
| Fortress | 14 × 14 | A walled keep in the middle with four gates and treasure inside |
| Open 12×12 | 12 × 12 | No walls |
| Quick 10×10 | 10 × 10 | No walls, short games |

Walls and power tiles are always placed point-symmetrically, so both corners face the same board.

**Controls:** click a colour button, press keys `1`–`6`, or click any tile on the board to pick its colour. A ★ next to a colour's count means that move sets off a power tile.

## Modes

| Mode | Description |
|---|---|
| vs Computer | You are Player 1. Choose Easy, Medium or Hard. |
| 2 Players | Pass-and-play on one device. |

**Computer difficulty:**

- **Easy** picks a random colour that captures something.
- **Medium** is greedy and takes the biggest grab, counting power tile effects.
- **Hard** looks five moves ahead with minimax and alpha-beta pruning. It scores positions by tile lead, open border, and power tiles within reach.

In bot-vs-bot simulations across all arenas, Medium beats Easy about 90% of the time, and Hard beats Medium 63–88% of the time depending on the arena. Equal bots win about 50/50 on every arena.

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
| `game.js` | Game rules, arenas, power tiles and the computer opponent (pure functions, no DOM) |
| `art.js` | Tile artwork shared by the board, legend and covers |
| `main.js` | Canvas drawing, input and UI |
| `platform.js` | Portal hooks (CrazyGames SDK). Every call is a no-op on your own site. |
| `fonts/` | Self-hosted Dela Gothic One and DM Sans (SIL Open Font License) |
| `tools/build-crazygames.py` | Builds the CrazyGames upload zip into `dist/` |
| `tools/cover.html` | Renders the store cover images |

The rules in `game.js` are exported for Node, so you can test them outside the browser:

```js
const G = require("./game.js");
const st = G.newState("islands", 1);   // arena key, who moves first
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
