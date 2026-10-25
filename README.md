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
| `style.css` | Layout and theme, including light and dark mode |
| `script.js` | Game rules, computer opponent, canvas drawing and UI |

The rules in `script.js` are pure functions and are exported for Node, so you can test them outside the browser:

```js
const G = require("./script.js");
const st = G.newState(12, 1);
G.playMove(st, G.chooseMove(G.cloneState(st), "hard"));
```
