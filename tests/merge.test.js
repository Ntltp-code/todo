// Run with: node tests/merge.test.js
global.window = { TODO_CONFIG: {}, addEventListener() {}, dispatchEvent() {} };
global.localStorage = { getItem() { return null; }, setItem() {} };
global.location = { search: '' };
global.document = { addEventListener() {}, readyState: 'complete' };
global.setInterval = function () {};
require('../gh-storage.js');
var assert = require('assert');
var M = window.TodoGH.mergeData;
var T = function (id, text, extra) { return Object.assign({ id: id, text: text, updatedAt: 1 }, extra || {}); };
var pack = function (a) { return { work_todos: JSON.stringify(a) }; };
var ids = function (o) { return JSON.parse(o.work_todos).map(function (t) { return t.id; }).sort(); };

// both devices add different tasks
var base = pack([T('a', 'A')]);
var out = M(base, pack([T('a', 'A'), T('b', 'B')]), pack([T('a', 'A'), T('c', 'C')]));
assert.deepStrictEqual(ids(out), ['a', 'b', 'c']);

// remote deleted, local unchanged -> gone; local edited -> kept
out = M(base, pack([T('a', 'A')]), pack([]));
assert.deepStrictEqual(ids(out), []);
out = M(base, pack([T('a', 'A edited', { updatedAt: 5 })]), pack([]));
assert.deepStrictEqual(ids(out), ['a']);

// local deleted, remote unchanged -> gone
out = M(base, pack([]), pack([T('a', 'A')]));
assert.deepStrictEqual(ids(out), []);

// both edited the same task: newest wins
out = M(base, pack([T('a', 'mine', { updatedAt: 5 })]), pack([T('a', 'theirs', { updatedAt: 9 })]));
assert.strictEqual(JSON.parse(out.work_todos)[0].text, 'theirs');

// string lists: union, removals respected
var lb = { work_categories: JSON.stringify(['x', 'y']) };
out = M(lb, { work_categories: JSON.stringify(['x', 'y', 'z']) }, { work_categories: JSON.stringify(['x']) });
assert.deepStrictEqual(JSON.parse(out.work_categories).sort(), ['x', 'z']);

// scalars: changed side wins
out = M({ work_theme: 'light' }, { work_theme: 'dark' }, { work_theme: 'light' });
assert.strictEqual(out.work_theme, 'dark');
console.log('all merge tests passed');
