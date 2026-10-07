/* auth-gate.js - sends you back to the login page unless a PIN was entered this session. */
(function () {
  var u = (new URLSearchParams(location.search).get('u') || '').toLowerCase();
  var ok = false;
  try { ok = !!u && sessionStorage.getItem('todo_authed_' + u) === '1'; } catch (e) {}
  if (!ok) { location.replace('index.html'); return; }
  var users = (window.TODO_CONFIG && TODO_CONFIG.users) || [];
  var name = u;
  users.forEach(function (x) { if (x.id === u) name = x.name; });
  document.title = 'To-do - ' + name;
})();
