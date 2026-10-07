# To-do

Static site (GitHub Pages). Task data syncs to a **private** repo, `ntltp-code/ntltp-private`, under `data/<user>.json`.

- `config.js` - users, data repo, branch (the only place to change these)
- `gh-storage.js` - local-first storage with 3-way merge sync to GitHub
- `app.html` / `app.js` / `styles.css` - the app
- `tests/merge.test.js` - `node tests/merge.test.js`

Setup on each device: open the login page, expand "Connect to GitHub", enter `ntltp-code/ntltp-private`, branch `main` and a fine-grained token limited to that repo (Contents: read and write).
