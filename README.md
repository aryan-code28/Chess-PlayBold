# CHESS — PLAY BOLD (Website)

A browser version of the supplied CustomTkinter chess app. It keeps the dark brown, gold and purple visual style and implements:

- Create account, login, logout, username change and password change
- Local player stats for wins, losses and draws
- Play against a basic computer opponent or play two-player on one device
- Legal move highlighting, captures, check/checkmate/draw detection and pawn promotion
- Three board themes, sound toggle, flip board, move history, undo and new game
- Responsive desktop/mobile layout

## Run in VS Code on macOS

1. Extract the ZIP.
2. Open VS Code → **File → Open Folder…** → choose `chess-play-bold-website`.
3. Install the **Live Server** extension by Ritwick Dey if you do not already have it.
4. Open `index.html`, then click **Go Live** in the bottom-right corner.
5. The website opens in your browser. Internet access is needed for the chess.js and font CDNs.

You can also use Python's simple local server from the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish using GitHub Pages

1. Create a new **public** repository on GitHub.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the repository root.
3. Go to **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
5. Wait for the Pages deployment and open the URL shown in Settings → Pages.

## Important limitations

This is a static, browser-only website. Accounts, password hashes, preferences and statistics are stored in that browser's local storage; they do not sync between devices and clearing site data can remove them. The password is hashed in the browser, but local storage is **not a secure production authentication system**. Do not use a real or reused password. For a public production service with secure accounts and synced scores, add a backend and database.

The computer opponent is a simple material-based bot, similar in spirit to the supplied Python code, not a grandmaster engine. Two-player mode is local pass-and-play on one device, not online multiplayer.

The website uses the open-source `chess.js` library from a CDN for chess rules. A network connection is required for that script to load.
