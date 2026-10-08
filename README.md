# To-do

Static site (GitHub Pages). Each person signs in with a 4-digit PIN and has their own list. Task data syncs to a **private** repo, `ntltp-code/ntltp-private`, under `data/<user>.json`.

- `index.html` - login (PIN) and "Connect to GitHub" setup
- `app.html` / `app.js` / `styles.css` - the to-do app
- `config.js` - users, data repo, branch (the only place to change these)
- `gh-storage.js` - local-first storage with 3-way merge sync to GitHub
- `auth-gate.js` - sends you back to login unless a PIN was entered this session
- `sw.js`, `manifest.webmanifest`, `icon.svg` - installable app and offline shell
- `tests/merge.test.js` - run with `node tests/merge.test.js`

Setup on each device: open the login page, expand "Connect to GitHub", enter `ntltp-code/ntltp-private`, branch `main` and a fine-grained token limited to that repo (Contents: read and write).
