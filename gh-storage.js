/* gh-storage.js - per-user storage for the to-do app.
   Saves to this device instantly and to a JSON file in a GitHub repo (<dir>/<user>.json) when a token is set.
   Conflicts are resolved with a 3-way merge (last synced copy / this device / GitHub), task by task. */
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
  var cache = jget(CK, { data: {}, sha: null, dirty: false, base: {} });
  var data = cache.data || {}, sha = cache.sha || null, dirty = !!cache.dirty, base = cache.base || {};
  var timer = null, busy = false, again = false, pulling = false;

  function persist() { jset(CK, { data: data, sha: sha, dirty: dirty, base: base }); }
  function status(s, m) { GH.status = { state: s, msg: m || '' }; window.dispatchEvent(new CustomEvent('todo-sync', { detail: GH.status })); }
  function hhmm() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(function () { push(false); }, ms == null ? 4000 : ms); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  async function push(keepalive) {
    if (!cfg().token) { status('local', 'Saved on this device only'); return; }
    if (busy) { again = true; return; }
    busy = true; status('syncing', 'Saving...');
    try {
      // always fold in what is on GitHub first, so another device's edits are never overwritten
      var f = await GH.getFile(file);
      if (f && f.sha !== sha) {
        data = mergeData(base, data, f.data);
        sha = f.sha;
        window.dispatchEvent(new CustomEvent('todo-remote-update'));
      } else if (!f) { sha = null; }
      var snap = JSON.stringify(data);
      try { sha = await GH.putFile(file, data, sha, keepalive); }
      catch (e) {
        if (e.status === 409 || e.status === 422) {
          var f2 = await GH.getFile(file);
          if (f2) { data = mergeData(base, data, f2.data); sha = f2.sha; window.dispatchEvent(new CustomEvent('todo-remote-update')); } else sha = null;
          snap = JSON.stringify(data);
          sha = await GH.putFile(file, data, sha, keepalive);
        } else throw e;
      }
      base = clone(data);
      if (JSON.stringify(data) === snap) dirty = false;
      persist(); status('ok', 'Saved to GitHub at ' + hhmm());
    } catch (e) {
      persist(); status('error', 'Could not save to GitHub (' + e.message + '). Kept on this device, will retry.');
      schedule(30000);
    } finally {
      busy = false;
      if (again) { again = false; schedule(0); }
    }
  }
  GH.pushNow = function () { clearTimeout(timer); return push(false); };

  // pull remote changes while idle (tab focus, and once a minute)
  async function pull() {
    if (pulling || busy || dirty || !cfg().token) return;
    pulling = true;
    try {
      var f = await GH.getFile(file);
      if (f && f.sha !== sha) {
        var merged = mergeData(base, data, f.data);
        var changed = JSON.stringify(merged) !== JSON.stringify(data);
        data = merged; sha = f.sha; base = clone(f.data);
        persist();
        if (changed) window.dispatchEvent(new CustomEvent('todo-remote-update'));
        status('ok', 'Updated from GitHub at ' + hhmm());
      }
    } catch (e) { /* offline: try again later */ }
    pulling = false;
  }
  setInterval(pull, 60000);

  var ready = (async function () {
    if (!cfg().token) { status('local', 'Saved on this device only'); return; }
    status('syncing', 'Loading...');
    try {
      var f = await GH.getFile(file);
      if (f) {
        if (dirty) { data = mergeData(base, data, f.data); }
        else { data = f.data; base = clone(f.data); }
        sha = f.sha;
      }
      persist();
      if (dirty) { schedule(0); } else { status('ok', 'Loaded from GitHub at ' + hhmm()); }
    } catch (e) {
      status('error', 'Could not reach GitHub (' + e.message + '). Using this device\'s copy, which may be out of date.');
    }
  })();

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
    var b = document.createElement('div');
    b.id = 'todo-userbar';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999;display:flex;gap:10px;align-items:center;padding:7px 12px;border-radius:999px;background:rgba(20,20,25,.92);color:#fff;font:12px/1.2 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3);max-width:calc(100vw - 20px)';
    var who = document.createElement('b'); who.textContent = NAMES[U] || U;
    var dot = document.createElement('span'); dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex:none';
    var msg = document.createElement('span'); msg.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    var sw = document.createElement('a'); sw.href = 'index.html'; sw.textContent = 'Switch user'; sw.style.cssText = 'color:#9cc9ff;text-decoration:underline;flex:none';
    sw.onclick = function () { try { sessionStorage.removeItem('todo_authed_' + U); } catch (e) {} };
    var hide = document.createElement('button'); hide.type = 'button'; hide.textContent = '×'; hide.setAttribute('aria-label', 'Collapse sync bar');
    hide.style.cssText = 'background:none;border:0;color:#fff;font-size:16px;line-height:1;cursor:pointer;flex:none;padding:0 2px';
    var open = true;
    hide.onclick = function () {
      open = !open;
      msg.style.display = sw.style.display = open ? '' : 'none';
      hide.textContent = open ? '×' : '•••';
      hide.setAttribute('aria-label', open ? 'Collapse sync bar' : 'Expand sync bar');
    };
    b.appendChild(who); b.appendChild(dot); b.appendChild(msg); b.appendChild(sw); b.appendChild(hide);
    document.body.appendChild(b);
    var colors = { ok: '#3ecf6e', syncing: '#f5b942', error: '#ef5b5b', local: '#8a8f98' };
    function show() { dot.style.background = colors[GH.status.state] || '#8a8f98'; msg.textContent = GH.status.msg; b.title = GH.status.msg; }
    window.addEventListener('todo-sync', show); show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBar); else mountBar();
})();
