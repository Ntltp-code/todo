/* gh-storage.js - per-user storage for the to-do app.
   Saves to this device instantly and to a JSON file in a GitHub repo (<dir>/<user>.json) when a token is set.
   Conflicts are resolved with a 3-way merge (last synced copy / this device / GitHub), task by task.
   Optional encryption seals the whole GitHub file and this device's copy with a passphrase; merging
   still happens task by task on the decrypted data in memory. */
(function () {
  'use strict';
  var CONF = window.TODO_CONFIG || {};
  var LEGACY_REPOS = ['', 'ntltp-code/todo', 'pauloulsonjenkins-afk/todolist'];

  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function cfg() {
    var c = jget('todo_gh_cfg', {});
    var repo = LEGACY_REPOS.indexOf(c.repo || '') >= 0 ? (CONF.dataRepo || '') : c.repo;
    return { repo: repo, branch: c.branch || CONF.branch || 'main', dir: c.dir || CONF.dir || 'data', token: c.token || '' };
  }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64d(s) { return decodeURIComponent(escape(atob(s.replace(/\s/g, '')))); }
  function url(path, c) { return 'https://api.github.com/repos/' + c.repo + '/contents/' + c.dir + '/' + path; }
  function hdr(c) { var h = { 'Accept': 'application/vnd.github+json' }; if (c.token) h['Authorization'] = 'Bearer ' + c.token; return h; }

  var GH = {
    cfg: cfg,
    status: { state: 'local', msg: 'Saved on this device only' },
    getFile: async function (path) {
      var c = cfg();
      var r = await fetch(url(path, c) + '?ref=' + encodeURIComponent(c.branch) + '&t=' + Date.now(), { headers: hdr(c), cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) { var e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
      var j = await r.json();
      return { data: JSON.parse(b64d(j.content)), sha: j.sha };
    },
    putFile: async function (path, obj, sha, keepalive) {
      var c = cfg();
      if (!c.token) throw new Error('no token');
      var body = { message: 'Update ' + path, content: b64e(JSON.stringify(obj, null, 1)), branch: c.branch };
      if (sha) body.sha = sha;
      var r = await fetch(url(path, c), { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr(c)), body: JSON.stringify(body), keepalive: !!keepalive });
      if (!r.ok) { var e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
      return (await r.json()).content.sha;
    }
  };
  window.TodoGH = GH;

  /* ---------- encryption (AES-256-GCM, key derived from a passphrase with PBKDF2) ---------- */
  var ENC_PREFIX = 'enc:v1:', ENC_ITER = 600000, ENC_CHECK = 'todo-ok';
  var subtle = window.crypto && window.crypto.subtle;
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function deriveKey(pass, meta) {
    var base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: b64ToBytes(meta.salt), iterations: meta.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, text) {
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text)));
    var out = new Uint8Array(12 + ct.length);
    out.set(iv, 0); out.set(ct, 12);
    return ENC_PREFIX + bytesToB64(out);
  }
  async function unseal(key, str) {
    var bytes = b64ToBytes(str.slice(ENC_PREFIX.length));
    return new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
  }
  // meta = { salt, iter, check }; check lets a passphrase be verified before touching the data
  async function newMeta(pass) {
    var meta = { salt: bytesToB64(window.crypto.getRandomValues(new Uint8Array(16))), iter: ENC_ITER };
    var key = await deriveKey(pass, meta);
    meta.check = await seal(key, ENC_CHECK);
    return { meta: meta, key: key };
  }
  // returns the key, or null if the passphrase is wrong for this meta
  async function keyIfCorrect(pass, meta) {
    try {
      var key = await deriveKey(pass, meta);
      return (await unseal(key, meta.check)) === ENC_CHECK ? key : null;
    } catch (e) { return null; }
  }
  function isSealed(d) { return !!(d && d.encrypted === true && typeof d.data === 'string'); }
  function metaOf(d) { return { salt: d.salt, iter: d.iter, check: d.check }; }
  async function wrap(obj, meta, key) {
    return { encrypted: true, v: 1, salt: meta.salt, iter: meta.iter, check: meta.check, data: await seal(key, JSON.stringify(obj)) };
  }
  GH.crypto = { available: !!subtle, newMeta: newMeta, keyIfCorrect: keyIfCorrect, wrap: wrap, isSealed: isSealed,
    unwrap: async function (d, key) { return JSON.parse(await unseal(key, d.data)); } };

  /* ---------- 3-way merge ---------- */
  function parseArr(s) { try { var a = JSON.parse(s); return Array.isArray(a) ? a : null; } catch (e) { return null; } }
  function isTaskList(a) { return a.every(function (x) { return x && typeof x === 'object' && typeof x.id === 'string'; }); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // tasks: keyed by id. Unchanged-on-one-side takes the other side (so deletions propagate).
  function mergeTasks(base, local, remote) {
    var B = {}, L = {}, R = {};
    base.forEach(function (t) { B[t.id] = t; });
    local.forEach(function (t) { L[t.id] = t; });
    remote.forEach(function (t) { R[t.id] = t; });
    var ids = [], seen = {};
    remote.concat(local).forEach(function (t) { if (!seen[t.id]) { seen[t.id] = 1; ids.push(t.id); } });
    var out = [];
    ids.forEach(function (id) {
      var b = B[id], l = L[id], r = R[id], pick;
      if (l && r) {
        if (same(l, r)) pick = l;
        else if (b && same(l, b)) pick = r;
        else if (b && same(r, b)) pick = l;
        else pick = (r.updatedAt || 0) > (l.updatedAt || 0) ? r : l;   // both edited: newest edit wins
      } else if (l && !r) {
        pick = (b && same(l, b)) ? null : l;      // remote deleted it; keep only if we edited it
      } else if (r && !l) {
        pick = (b && same(r, b)) ? null : r;      // we deleted it; keep only if remote edited it
      }
      if (pick) out.push(pick);
    });
    return out;
  }

  // plain lists (categories etc.): union, minus anything either side removed
  function mergeLists(base, local, remote) {
    var inB = function (x) { return base.some(function (y) { return same(x, y); }); };
    var has = function (arr, x) { return arr.some(function (y) { return same(x, y); }); };
    var out = [];
    remote.concat(local).forEach(function (x) {
      if (has(out, x)) return;
      var removed = inB(x) && (!has(local, x) || !has(remote, x));
      if (!removed) out.push(x);
    });
    return out;
  }

  function mergeData(base, local, remote) {
    var out = {};
    var keys = {};
    [base, local, remote].forEach(function (o) { Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).forEach(function (k) {
      var b = base[k], l = local[k], r = remote[k];
      var inL = Object.prototype.hasOwnProperty.call(local, k), inR = Object.prototype.hasOwnProperty.call(remote, k);
      if (inL && inR && l === r) { out[k] = l; return; }
      if (inL && inR) {
        var la = parseArr(l), ra = parseArr(r), ba = parseArr(b || '[]') || [];
        if (la && ra) {
          out[k] = JSON.stringify((isTaskList(la) && isTaskList(ra) && isTaskList(ba)) ? mergeTasks(ba, la, ra) : mergeLists(ba, la, ra));
          return;
        }
        out[k] = (l === b) ? r : l;                // scalar: whoever changed it wins, this device on a tie
        return;
      }
      if (inL && !inR) { if (l !== b) out[k] = l; return; }
      if (inR && !inL) { if (r !== b) out[k] = r; }
    });
    return out;
  }
  GH.mergeData = mergeData;

  // read-modify-write another file in the data folder, retrying if someone else saved in between
  GH.updateFile = async function (path, mutate) {
    if (!cfg().token) throw new Error('Connect to GitHub first (login page > Connect to GitHub).');
    var lastErr;
    for (var i = 0; i < 3; i++) {
      var f = await GH.getFile(path);
      var next = mutate(f ? f.data : null);
      try { await GH.putFile(path, next, f ? f.sha : null); return next; }
      catch (e) { lastErr = e; if (e.status !== 409 && e.status !== 422) throw e; }
    }
    throw lastErr;
  };

  // add a copy of a task to another user's list (they pick it up on their next sync)
  GH.sendTask = function (toUser, task, key) {
    return GH.updateFile(toUser + '.json', function (d) {
      d = d || {};
      var arr = parseArr(d[key] || '[]') || [];
      if (!arr.some(function (t) { return t.id === task.id; })) arr.push(task);
      d[key] = JSON.stringify(arr);
      return d;
    });
  };

  // old completed tasks live in <user>-archive.json so the main file stays small
  GH.archiveTasks = function (user, tasks) {
    return GH.updateFile(user + '-archive.json', function (d) {
      var all = (d && Array.isArray(d.tasks)) ? d.tasks : [];
      tasks.forEach(function (t) { if (!all.some(function (x) { return x.id === t.id; })) all.push(t); });
      return { tasks: all };
    });
  };
  GH.readArchive = async function (user) {
    var f = await GH.getFile(user + '-archive.json');
    return (f && Array.isArray(f.data.tasks)) ? f.data.tasks : [];
  };
  GH.clearArchive = function (user) {
    return GH.updateFile(user + '-archive.json', function () { return { tasks: [] }; });
  };

  var U = (new URLSearchParams(location.search).get('u') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!U) return;

  var NAMES = {};
  (CONF.users || []).forEach(function (u) { NAMES[u.id] = u.name; });
  var file = U + '.json';
  var CK = 'todo_cache_' + U;
  var cacheRaw = jget(CK, {});
  var sealedCache = (cacheRaw.blob && cacheRaw.enc) ? cacheRaw : null;
  var cache = sealedCache ? {} : cacheRaw;
  var data = cache.data || {}, sha = cache.sha || null, dirty = !!cache.dirty, base = cache.base || {};
  var timer = null, busy = false, again = false, pulling = false;

  // encryption state. The passphrase is kept in memory only, so files sealed with a fresh salt
  // (turned off and on again elsewhere) can still be opened without asking again. Keys already
  // used this session (salt -> key) are kept too, so after changing the passphrase or turning
  // encryption off this device can still read GitHub's copy that was sealed the old way.
  var enc = null, encKey = null, encPass = '', keys = {};
  var encDirty = !!cacheRaw.encDirty;   // encryption was changed here and GitHub doesn't have it yet
  var encGen = 0;                       // bumped on every local change, so a push in flight can't clear a newer one
  var loaded = !sealedCache;            // false until this device's sealed copy has been opened
  var locked = null, lockReason = '', unlockWaiters = [];
  var persistChain = Promise.resolve();

  // writes go through one chain so an older (slower, encrypted) write can never land after a newer one
  function persist() {
    if (!loaded) return;   // never overwrite a sealed copy we have not opened
    var snap = { data: data, sha: sha, dirty: dirty, base: base };
    var meta = enc, key = encKey, ed = encDirty;
    var text = JSON.stringify(snap);
    persistChain = persistChain.then(async function () {
      if (meta && key) jset(CK, { enc: meta, blob: await seal(key, text), encDirty: ed });
      else jset(CK, Object.assign(JSON.parse(text), { encDirty: ed }));
    }).catch(function (e) { console.error('Could not save this device\'s copy', e); });
  }
  function status(s, m) { GH.status = { state: s, msg: m || '' }; window.dispatchEvent(new CustomEvent('todo-sync', { detail: GH.status })); }
  function hhmm() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(function () { push(false); }, ms == null ? 4000 : ms); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // pause until the right passphrase for `meta` is entered (the app shows the prompt)
  function needKey(meta, reason) {
    locked = meta; lockReason = reason;
    window.dispatchEvent(new CustomEvent('todo-enc-locked', { detail: { reason: reason } }));
    return new Promise(function (r) { unlockWaiters.push(r); });
  }
  function relock(meta) {
    status('error', 'Your list on GitHub uses a different passphrase (probably changed on another device). Enter it to keep syncing.');
    needKey(meta, 'changed').then(function () { schedule(0); });
  }
  async function keyFor(meta) {
    if (keys[meta.salt]) return keys[meta.salt];
    var k = encPass ? await keyIfCorrect(encPass, meta) : null;
    if (k) keys[meta.salt] = k;
    return k;
  }
  // GitHub's copy, decrypted. Throws an error with .locked = meta if we don't have its passphrase.
  async function openRemote(f) {
    if (!f || !isSealed(f.data)) return f && { data: f.data, sha: f.sha, meta: null, key: null };
    var meta = metaOf(f.data), key = await keyFor(meta);
    if (!key) { var e = new Error('locked'); e.locked = meta; throw e; }
    return { data: JSON.parse(await unseal(key, f.data.data)), sha: f.sha, meta: meta, key: key };
  }
  async function readRemote() { return openRemote(await GH.getFile(file)); }
  // follow the encryption setting on GitHub, unless this device has an unsent change to it
  function adopt(f) {
    if (encDirty) return;
    enc = f.meta; encKey = f.key;
    if (!enc) encPass = '';
  }
  async function writeRemote(keepalive) {
    var body = (enc && encKey) ? await wrap(data, enc, encKey) : data;
    return GH.putFile(file, body, sha, keepalive);
  }

  async function push(keepalive) {
    if (!cfg().token) { status('local', 'Saved on this device only'); return; }
    if (locked || !loaded) return;
    if (busy) { again = true; return; }
    busy = true; status('syncing', 'Saving...');
    var gen = encGen;
    try {
      // always fold in what is on GitHub first, so another device's edits are never overwritten
      var f = await readRemote();
      if (f && f.sha !== sha) {
        data = mergeData(base, data, f.data);
        sha = f.sha; adopt(f);
        window.dispatchEvent(new CustomEvent('todo-remote-update'));
      } else if (!f) { sha = null; }
      var snap = JSON.stringify(data);
      try { sha = await writeRemote(keepalive); }
      catch (e) {
        if (e.status === 409 || e.status === 422) {
          var f2 = await readRemote();
          if (f2) { data = mergeData(base, data, f2.data); sha = f2.sha; adopt(f2); window.dispatchEvent(new CustomEvent('todo-remote-update')); } else sha = null;
          snap = JSON.stringify(data);
          sha = await writeRemote(keepalive);
        } else throw e;
      }
      base = clone(data);
      if (gen === encGen) encDirty = false;
      if (JSON.stringify(data) === snap) dirty = false;
      persist(); status('ok', 'Saved to GitHub at ' + hhmm());
    } catch (e) {
      persist();
      if (e.locked) relock(e.locked);
      else { status('error', 'Could not save to GitHub (' + e.message + '). Kept on this device, will retry.'); schedule(30000); }
    } finally {
      busy = false;
      var w = idleWaiters; idleWaiters = [];
      w.forEach(function (r) { r(); });
      if (again && !locked) { again = false; schedule(0); }
    }
  }
  var idleWaiters = [];
  // save now; if a save is already running, wait for it first so this one includes the latest changes
  GH.pushNow = async function () {
    if (busy) await new Promise(function (r) { idleWaiters.push(r); });
    clearTimeout(timer); again = false;
    return push(false);
  };

  // pull remote changes while idle (tab focus, and once a minute)
  async function pull() {
    if (pulling || busy || dirty || locked || !loaded || !cfg().token) return;
    pulling = true;
    try {
      var f = await readRemote();
      if (f && f.sha !== sha) {
        var merged = mergeData(base, data, f.data);
        var changed = JSON.stringify(merged) !== JSON.stringify(data);
        data = merged; sha = f.sha; base = clone(f.data); adopt(f);
        persist();
        if (changed) window.dispatchEvent(new CustomEvent('todo-remote-update'));
        status('ok', 'Updated from GitHub at ' + hhmm());
      }
    } catch (e) { if (e.locked) relock(e.locked); /* otherwise offline: try again later */ }
    pulling = false;
  }
  setInterval(pull, 60000);

  var ready = (async function () {
    var token = !!cfg().token, raw = null, fetchErr = null;
    if (token) {
      status('syncing', 'Loading...');
      try { raw = await GH.getFile(file); } catch (e) { fetchErr = e; }
    }
    // GitHub's copy decides which passphrase to ask for; otherwise this device's sealed copy does
    var need = (raw && isSealed(raw.data)) ? metaOf(raw.data) : (sealedCache && sealedCache.enc);
    if (need) {
      status('local', 'Locked: waiting for your passphrase');
      await needKey(need, 'start');
    }
    if (sealedCache) {
      var ck = await keyFor(sealedCache.enc), c = null;
      if (ck) { try { c = JSON.parse(await unseal(ck, sealedCache.blob)); } catch (e) { c = null; } }
      if (c) {
        data = c.data || {}; sha = c.sha || null; dirty = !!c.dirty; base = c.base || {};
        enc = sealedCache.enc; encKey = ck;
      } else {
        // only happens when GitHub's copy uses a newer passphrase than this device's copy
        console.warn('This device\'s copy could not be opened with that passphrase, so the copy on GitHub is used instead.');
      }
    }
    loaded = true;
    if (raw) {
      try {
        var f = await openRemote(raw);
        if (dirty) { data = mergeData(base, data, f.data); }
        else { data = f.data; base = clone(f.data); }
        sha = f.sha; adopt(f);
      } catch (e) { fetchErr = e; }
    }
    persist();
    if (fetchErr) status('error', 'Could not reach GitHub (' + fetchErr.message + '). Using this device\'s copy, which may be out of date.');
    else if (!token) status('local', 'Saved on this device only');
    else if (dirty || encDirty) schedule(0);
    else status('ok', 'Loaded from GitHub at ' + hhmm());
  })();

  async function unlock(pass) {
    if (!locked || !subtle || !pass) return false;
    var key = await keyIfCorrect(pass, locked);
    if (!key) return false;
    encPass = pass; keys[locked.salt] = key;
    locked = null; lockReason = '';
    var w = unlockWaiters; unlockWaiters = [];
    w.forEach(function (r) { r(); });
    return true;
  }
  function encChanged() { encGen++; encDirty = true; dirty = true; persist(); schedule(0); }
  GH.encryption = {
    available: !!subtle,
    state: function () { return locked ? 'locked' : (enc && encKey ? 'on' : 'off'); },
    lockReason: function () { return lockReason; },
    unlock: unlock,
    // turn on, or change the passphrase (a new salt each time)
    enable: async function (pass) {
      await ready;
      var m = await newMeta(pass);
      enc = m.meta; encKey = m.key; encPass = pass; keys[m.meta.salt] = m.key;
      encChanged();
    },
    disable: async function () {
      await ready;
      enc = null; encKey = null; encPass = '';
      encChanged();
    }
  };

  window.storage = {
    get: async function (k) { await ready; return Object.prototype.hasOwnProperty.call(data, k) ? { key: k, value: data[k], shared: false } : null; },
    set: async function (k, v) { await ready; data[k] = String(v); dirty = true; persist(); schedule(); return { key: k, value: v, shared: false }; },
    delete: async function (k) { await ready; delete data[k]; dirty = true; persist(); schedule(); return { key: k, deleted: true, shared: false }; },
    list: async function (p) { await ready; return { keys: Object.keys(data).filter(function (k) { return !p || k.indexOf(p) === 0; }), shared: false }; }
  };

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && dirty && cfg().token) { clearTimeout(timer); push(true); }
    else if (document.visibilityState === 'visible') pull();
  });
  window.addEventListener('online', function () { if (dirty) push(false); else pull(); });

  function mountBar() {
    var header = document.querySelector('header');
    var colors = { ok: '#3ecf6e', syncing: '#f5b942', error: '#ef5b5b', local: '#8a8f98' };
    var dot = document.createElement('span');
    dot.className = 'sync-dot';
    dot.setAttribute('role', 'status');
    dot.setAttribute('aria-live', 'polite');
    var err = document.createElement('div');
    err.className = 'sync-error';
    err.setAttribute('role', 'alert');
    err.style.display = 'none';
    if (header) {
      header.appendChild(dot);
      header.insertAdjacentElement('afterend', err);
      var ver = header.querySelector('.version-label');
      if (ver) {
        var sw = document.createElement('a');
        sw.href = 'index.html'; sw.className = 'switch-link'; sw.textContent = 'Switch user';
        sw.onclick = function () { try { sessionStorage.removeItem('todo_authed_' + U); } catch (e) {} };
        ver.appendChild(sw);
      }
    }
    function show() {
      var s = GH.status;
      dot.dataset.state = s.state;
      dot.style.background = colors[s.state] || '#8a8f98';
      dot.title = (NAMES[U] || U) + ': ' + s.msg;
      dot.setAttribute('aria-label', 'Sync status: ' + s.msg);
      err.textContent = s.state === 'error' ? s.msg : '';
      err.style.display = s.state === 'error' ? 'block' : 'none';
    }
    window.addEventListener('todo-sync', show); show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBar); else mountBar();
})();
