/* sw.js - caches the app shell so it opens offline. Cross-origin calls (GitHub API) are never cached. */
var CACHE = 'todo-shell-v29';
var SHELL = ['index.html', 'app.html', 'styles.css', 'app.js', 'config.js', 'auth-gate.js', 'gh-storage.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // always ask the server whether a file changed (never the browser's own short-term cache),
  // so a new page can't be paired with an older stylesheet or script after an update
  e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
