  const listEl = document.getElementById('list');
  const emptyMsg = document.getElementById('emptyMsg');
  const listHeader = document.getElementById('listHeader');
  const lhCompleted = document.getElementById('lhCompleted');
  const lhSleep = document.getElementById('lhSleep');
  const countLabel = document.getElementById('countLabel');
  const input = document.getElementById('newItem');
  const dueDateInput = document.getElementById('dueDateInput');
  const prioritySelect = document.getElementById('prioritySelect');
  const categorySelect = document.getElementById('categorySelect');
  const assigneeChecklist = document.getElementById('assigneeChecklist');
  const addBtn = document.getElementById('addBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const dateLabel = document.getElementById('dateLabel');
  const tabToday = document.getElementById('tabToday');
  const tabActive = document.getElementById('tabActive');
  const tabPending = document.getElementById('tabPending');
  const tabDone = document.getElementById('tabDone');
  const addRow = document.getElementById('addRow');
  const newTaskBtn = document.getElementById('newTaskBtn');
  const newTaskOverlay = document.getElementById('newTaskOverlay');
  const taskEditOverlay = document.getElementById('taskEditOverlay');
  const taskEditBody = document.getElementById('taskEditBody');
  const taskEditTitle = document.getElementById('taskEditTitle');
  const taskEditFooter = document.getElementById('taskEditFooter');
  let lastEditedId = null;
  const sortSelect = document.getElementById('sortSelect');
  const repeatSelect = document.getElementById('repeatSelect');
  let selectMode = false;
  const selectedIds = new Set();
  const searchInput = document.getElementById('searchInput');
  let searchTerm = '';
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const categoryList = document.getElementById('categoryList');
  const newCategoryInput = document.getElementById('newCategoryInput');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const assigneeList = document.getElementById('assigneeList');
  const newAssigneeInput = document.getElementById('newAssigneeInput');
  const addAssigneeBtn = document.getElementById('addAssigneeBtn');
  const assignedByListEl = document.getElementById('assignedByList');
  const newAssignedByInput = document.getElementById('newAssignedByInput');
  const addAssignedByBtn = document.getElementById('addAssignedByBtn');
  const assignedBySelect = document.getElementById('assignedBySelect');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const reminderEmailInput = document.getElementById('reminderEmailInput');
  const emailPriorityBtn = document.getElementById('emailPriorityBtn');
  const reportBtn = document.getElementById('reportBtn');
  const lockBtn = document.getElementById('lockBtn');
  const lockOverlay = document.getElementById('lockOverlay');
  const passwordStatus = document.getElementById('passwordStatus');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const setPasswordBtn = document.getElementById('setPasswordBtn');
  const removePasswordBtn = document.getElementById('removePasswordBtn');
  const unlockInput = document.getElementById('unlockInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const unlockError = document.getElementById('unlockError');

  // the small version label under the date mirrors the one in Settings, so there's one place to change it
  document.getElementById('headerVersion').textContent = document.querySelector('.settings-version').textContent;
  dateLabel.textContent =new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  let todos = [];
  let categories = ['Work', 'Personal', 'Errands'];
  let assignees = [];
  let assignedByOptions = [];
  let selectedAddAssignees = [];
  let expandedIds = new Set();
  const subtaskDrafts = {};
  const addEntryTypeByItem = {};
  let confirmingSubtaskDelete = new Set();
  let confirmingTaskDelete = new Set();
  let page = 'active';
  let addFormOpen = false;
  let sortBy = 'priority';
  let filterMode = null;
  let hasExportedThisSession = false;
  const STORAGE_PREFIX = 'work_';
  const STORAGE_KEY = STORAGE_PREFIX + 'todos';
  const CATEGORIES_KEY = STORAGE_PREFIX + 'categories';
  const ASSIGNEES_KEY = STORAGE_PREFIX + 'assignees';
  const ASSIGNED_BY_KEY = STORAGE_PREFIX + 'assignedByOptions';
  const THEME_KEY = STORAGE_PREFIX + 'theme';
  const LAYOUT_KEY = STORAGE_PREFIX + 'layout';
  const LOCAL_UPDATED_KEY = STORAGE_PREFIX + 'localDataUpdatedAt';
  let localDataUpdatedAt = 0;
  const LAST_EXPORT_KEY = STORAGE_PREFIX + 'lastExportAt';
  const REMINDER_EMAIL_KEY = STORAGE_PREFIX + 'reminderEmail';
  let lastExportAt = 0;
  const PASSWORD_HASH_KEY = STORAGE_PREFIX + 'appPasswordHash';
  let passwordHash = '';

  function sortAlpha(arr) {
    arr.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    // "YYYY-MM-DD" strings are read as local dates, not UTC midnight
    const d = typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp) ? new Date(timestamp + 'T00:00:00') : new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    // one style everywhere: "22 Oct", with the year only when it isn't this year
    const opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-GB', opts);
  }

  // due dates in words where that reads better: Today, Tomorrow, Overdue 3 days, else "22 Oct"
  function formatDue(dueDate) {
    const iso = toISODate(dueDate);
    if (!iso) return '';
    const today = todayDateString();
    if (iso === today) return 'Today';
    if (iso === addDaysToToday(1)) return 'Tomorrow';
    if (iso < today) {
      const days = Math.round((new Date(today + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000);
      return 'Overdue ' + days + (days === 1 ? ' day' : ' days');
    }
    return formatDate(iso);
  }

  const STALE_DAYS = 14;
  function isStale(t) {
    return !t.done && !t.pending && Date.now() - (t.updatedAt || t.createdAt || 0) > STALE_DAYS * 86400000;
  }

  // the Today tab: overdue, due today, or starred
  function isTodayTask(t) {
    return !t.done && (!!t.starred || t.dueDate === todayDateString() || isPastDue(t.dueDate));
  }

  function formatDateDDMM(timestamp) {
    return formatDate(timestamp);
  }

  function formatFooterTimestamp(timestamp) {
    if (!timestamp) return 'never';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'never';
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return formatDate(timestamp) + ' ' + time;
  }

  function updateFooterStatus() {
    const syncLine = document.getElementById('lastSyncLine');
    const exportLine = document.getElementById('lastExportLine');
    if (exportLine) exportLine.textContent = 'Last export: ' + formatFooterTimestamp(lastExportAt);
  }

  function toISODate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function toUKDateShort(value) {
    const iso = toISODate(value);
    return iso ? formatDate(iso) : '';
  }

  function isPastDue(dueDate) {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  function checkPendingDueDates() {
    const todayStr = todayDateString();
    let changed = false;
    todos.forEach(t => {
      if (!t.done && t.pending) {
        const stillSleeping = t.snoozeUntil && t.snoozeUntil > todayStr;
        if (t.snoozeUntil && t.snoozeUntil <= todayStr) {
          // Sleep timer has run out - wake it up, regardless of due date.
          t.pending = false;
          t.snoozeUntil = null;
          t.wokeUp = true;
          t.wokeAt = todayStr;
          changed = true;
        } else if (!stillSleeping && t.dueDate && t.dueDate <= todayStr) {
          // No active sleep timer - fall back to the normal due-date wake check.
          t.pending = false;
          changed = true;
        }
      }
    });
    return changed;
  }

  function addDaysToToday(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function todayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  const hasPlatformStorage = typeof window.storage !== 'undefined' && window.storage !== null;

  async function storageGet(key) {
    if (hasPlatformStorage) {
      try {
        return await window.storage.get(key, false);
      } catch (e) {
        // Expected the first time a key hasn't been saved yet (e.g. new install,
        // or a newly-added key like "categories") - not a real failure, so we
        // just quietly fall through to local storage instead of logging it.
      }
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? { key, value: raw, shared: false } : null;
    } catch (e) {
      console.error('Local storage read failed', e);
      return null;
    }
  }

  let writeQueue = Promise.resolve();

  function queuedStorageSet(key, value) {
    writeQueue = writeQueue
      .catch(() => {})
      .then(() => storageSetWithRetry(key, value));
    return writeQueue;
  }

  async function storageSetWithRetry(key, value) {
    if (hasPlatformStorage) {
      try {
        await window.storage.set(key, value, false);
        return;
      } catch (e) {
        try {
          await new Promise(r => setTimeout(r, 400));
          await window.storage.set(key, value, false);
          return;
        } catch (e2) {
          console.warn('Platform storage write failed twice, falling back to local storage', e2);
        }
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch (e3) {
      console.error('Local storage write failed', e3);
    }
  }

  // trimmed to six well-tested themes; anyone on a removed one falls back to 'auto'
  const VALID_THEMES = ['auto', 'warm', 'warmdark', 'light', 'dark', 'bw', 'terminal'];

  let themeSetting = 'auto';
  const VALID_LAYOUTS = ['original', 'paper', 'sage', 'linen'];
  const LAYOUT_BAR_COLOURS = { paper: '#2563EB', sage: '#2E6A4F', linen: '#A84A28' };
  let layoutSetting = 'original';
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', () => { if (themeSetting === 'auto') applyTheme('auto'); });
  }

  function applyTheme(theme) {
    if (!VALID_THEMES.includes(theme)) theme = 'auto';
    themeSetting = theme;
    const shown = theme === 'auto' ? ((darkQuery && darkQuery.matches) ? 'warmdark' : 'warm') : theme;
    document.body.classList.remove('theme-warm', 'theme-warmdark', 'theme-dark', 'theme-colourful', 'theme-notebook', 'theme-forest', 'theme-ocean', 'theme-sunset', 'theme-slate', 'theme-bw', 'theme-wb', 'theme-terminal');
    // phones tint their address bar with this; Terminal keeps it black, the new layouts use their own accent
    const themeColour = document.querySelector('meta[name="theme-color"]');
    if (themeColour) themeColour.content = LAYOUT_BAR_COLOURS[layoutSetting] || (shown === 'terminal' ? '#000000' : '#C96442');
    // the new layouts bring their own colours, so themes only apply to the Original layout
    if (shown !== 'light' && layoutSetting === 'original') {
      document.body.classList.add('theme-' + shown);
    }
    document.querySelectorAll('.theme-option[data-theme]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.theme === theme);
    });
    // a plain copy for the start-up script in app.html, which can't wait for (or decrypt) the synced data
    try {
      const u = (new URLSearchParams(location.search).get('u') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      localStorage.setItem('todo_theme_' + u, theme);
    } catch (e) {}
  }

  async function selectTheme(theme) {
    applyTheme(theme);
    await queuedStorageSet(THEME_KEY, theme);
  }

  document.querySelectorAll('.theme-option[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
  });

  // layouts: Original (the themes above) or one of the light designs
  function applyLayout(layout) {
    if (!VALID_LAYOUTS.includes(layout)) layout = 'original';
    layoutSetting = layout;
    VALID_LAYOUTS.forEach(l => document.body.classList.remove('layout-' + l));
    if (layout !== 'original') {
      document.body.classList.add('layout-' + layout);
      if (!document.getElementById('layoutFonts')) {
        const link = document.createElement('link');
        link.id = 'layoutFonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap';
        document.head.appendChild(link);
      }
    }
    document.querySelectorAll('.layout-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.layout === layout);
    });
    applyTheme(themeSetting);
    try {
      const u = (new URLSearchParams(location.search).get('u') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      localStorage.setItem('todo_layout_' + u, layout);
    } catch (e) {}
  }

  async function selectLayout(layout) {
    applyLayout(layout);
    await queuedStorageSet(LAYOUT_KEY, layout);
  }

  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.addEventListener('click', () => selectLayout(btn.dataset.layout));
  });

  // Linen & Clay's summary cards just press the matching filter or tab
  document.querySelectorAll('.layout-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = document.getElementById(card.dataset.click);
      if (target) target.click();
    });
  });

  // Stamp each task that changed since the last save, so sync can tell which edit is newest.
  const savedFingerprints = new Map();
  function fingerprint(t) { return JSON.stringify(Object.assign({}, t, { updatedAt: 0 })); }
  function stampUpdated() {
    const now = Date.now();
    todos.forEach(t => {
      const fp = fingerprint(t);
      if (savedFingerprints.has(t.id) ? savedFingerprints.get(t.id) !== fp : !t.updatedAt) t.updatedAt = now;
      savedFingerprints.set(t.id, fp);
    });
  }

  // ---------- toasts, undo and in-page confirm ----------
  const toastBox = document.getElementById('toastBox');
  let toastTimer = null;
  function showToast(message, undoFn) {
    toastBox.textContent = '';
    const msg = document.createElement('span');
    msg.textContent = message;
    toastBox.appendChild(msg);
    if (undoFn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Undo';
      b.addEventListener('click', () => { toastBox.classList.remove('show'); undoFn(); });
      toastBox.appendChild(b);
    }
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), undoFn ? 8000 : 4000);
  }

  function snapshotUndo(message) {
    const snap = JSON.stringify(todos);
    showToast(message, () => {
      todos = JSON.parse(snap);
      render();
      save();
      showToast('Restored.');
    });
  }

  const confirmOverlay = document.getElementById('confirmOverlay');
  function askConfirm(message, okLabel) {
    return new Promise(resolve => {
      document.getElementById('confirmText').textContent = message;
      const ok = document.getElementById('confirmOk');
      const cancel = document.getElementById('confirmCancel');
      ok.textContent = okLabel || 'OK';
      const done = v => {
        confirmOverlay.classList.remove('open');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        resolve(v);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onKey = e => { if (e.key === 'Escape') done(false); };
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
      confirmOverlay.classList.add('open');
      cancel.focus();
    });
  }

  // ---------- recurring tasks ----------
  function nextDueDate(dateStr, repeat) {
    const p = dateStr.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    if (repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
    else if (repeat === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    else if (repeat === 'monthly') {
      const day = p[2];
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
    } else return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function spawnNextRepeat(item) {
    if (!item.repeat || !item.dueDate) return;
    let next = nextDueDate(item.dueDate, item.repeat);
    const today = todayDateString();
    while (next && next < today) next = nextDueDate(next, item.repeat);
    if (!next) return;
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = uid();
    copy.done = false;
    copy.pending = false;
    copy.snoozeUntil = null;
    copy.wokeUp = false;
    copy.completedAt = null;
    copy.createdAt = Date.now();
    copy.dueDate = next;
    copy.subtasks = (item.subtasks || []).filter(x => x.type !== 'note').map(x => Object.assign({}, x, { id: uid(), done: false }));
    todos.push(copy);
    return next;
  }

  const ARCHIVE_KEY = STORAGE_PREFIX + 'archive';
  let archivedTasks = [];

  // ---------- archiving old completed tasks (synced with the rest of your list) ----------
  const ARCHIVE_DAYS = 90;
  const archiveStatusEl = document.getElementById('archiveStatus');
  function archiveSay() {
    if (archiveStatusEl) archiveStatusEl.textContent = archivedTasks.length + ' task' + (archivedTasks.length === 1 ? '' : 's') + ' in the archive.';
  }

  async function archiveOldCompleted(manual) {
    const cutoff = Date.now() - ARCHIVE_DAYS * 86400000;
    const old = todos.filter(t => t.done && t.completedAt && t.completedAt < cutoff);
    if (!old.length) {
      if (manual) showToast('Nothing completed more than ' + ARCHIVE_DAYS + ' days ago.');
      return;
    }
    const have = new Set(archivedTasks.map(t => t.id));
    old.forEach(t => { if (!have.has(t.id)) archivedTasks.push(t); });
    const ids = new Set(old.map(t => t.id));
    todos = todos.filter(t => !ids.has(t.id));
    await queuedStorageSet(ARCHIVE_KEY, JSON.stringify(archivedTasks));
    render();
    save();
    archiveSay();
    showToast('Archived ' + old.length + ' completed task' + (old.length === 1 ? '' : 's') + ' older than ' + ARCHIVE_DAYS + ' days.');
  }

  async function restoreArchive() {
    if (!archivedTasks.length) { showToast('The archive is empty.'); return; }
    const have = new Set(todos.map(t => t.id));
    const n = archivedTasks.length;
    archivedTasks.forEach(t => { if (!have.has(t.id)) todos.push(t); });
    archivedTasks = [];
    await queuedStorageSet(ARCHIVE_KEY, JSON.stringify(archivedTasks));
    render();
    save();
    archiveSay();
    showToast('Restored ' + n + ' task' + (n === 1 ? '' : 's') + ' from the archive.');
  }

  document.getElementById('archiveNowBtn').addEventListener('click', () => archiveOldCompleted(true));
  document.getElementById('restoreArchiveBtn').addEventListener('click', restoreArchive);
  document.getElementById('settingsBtn').addEventListener('click', archiveSay);

  setTimeout(() => {
    try {
      const k = 'work_last_archive_run';
      if (Date.now() - (parseInt(localStorage.getItem(k), 10) || 0) < 86400000) return;
      localStorage.setItem(k, String(Date.now()));
    } catch (e) { /* storage unavailable: archive anyway */ }
    archiveOldCompleted(false);
  }, 8000);

  (function showWhoseList() {
    const u = (new URLSearchParams(location.search).get('u') || '').toLowerCase();
    const users = (window.TODO_CONFIG && TODO_CONFIG.users) || [];
    const me = users.find(x => x.id === u);
    const name = me ? me.name : u;
    if (!name) return;
    ['appLabelHeader', 'appLabelFooter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });
  })();

  window.addEventListener('todo-remote-update', async () => {
    try {
      const r = await storageGet(STORAGE_KEY);
      todos = r ? JSON.parse(r.value) : [];
      const c = await storageGet(CATEGORIES_KEY);
      if (c) { const a = JSON.parse(c.value); if (Array.isArray(a)) categories = a; }
      const a2 = await storageGet(ASSIGNEES_KEY);
      if (a2) { const a = JSON.parse(a2.value); if (Array.isArray(a)) assignees = a; }
      const b = await storageGet(ASSIGNED_BY_KEY);
      if (b) { const a = JSON.parse(b.value); if (Array.isArray(a)) assignedByOptions = a; }
      const ar = await storageGet(ARCHIVE_KEY);
      if (ar) { const a = JSON.parse(ar.value); if (Array.isArray(a)) archivedTasks = a; }
      populateCategorySelect(); renderCategoryList(); populateAssigneeChecklist(); renderAssigneeList(); populateAssignedBySelect(); renderAssignedByList();
      updateEncryptionUI();
      render();
    } catch (e) { /* keep what is on screen */ }
  });

  async function load() {
    try {
      const layoutResult = await storageGet(LAYOUT_KEY);
      applyLayout(layoutResult && layoutResult.value ? layoutResult.value : 'original');
    } catch (e) {
      applyLayout('original');
    }
    try {
      const themeResult = await storageGet(THEME_KEY);
      applyTheme(themeResult && themeResult.value ? themeResult.value : 'auto');
    } catch (e) {
      applyTheme('auto');
    }
    try {
      const result = await storageGet(STORAGE_KEY);
      todos = result ? JSON.parse(result.value) : [];
    } catch (e) {
      todos = [];
    }
    if (checkPendingDueDates()) {
      save();
    }
    try {
      const catResult = await storageGet(CATEGORIES_KEY);
      if (catResult) {
        const parsed = JSON.parse(catResult.value);
        if (Array.isArray(parsed)) categories = parsed;
      }
    } catch (e) {
      // keep default categories
    }
    sortAlpha(categories);
    try {
      const assigneeResult = await storageGet(ASSIGNEES_KEY);
      if (assigneeResult) {
        const parsed = JSON.parse(assigneeResult.value);
        if (Array.isArray(parsed)) assignees = parsed;
      }
    } catch (e) {
      // keep default assignees
    }
    sortAlpha(assignees);
    try {
      const assignedByResult = await storageGet(ASSIGNED_BY_KEY);
      if (assignedByResult) {
        const parsed = JSON.parse(assignedByResult.value);
        if (Array.isArray(parsed)) assignedByOptions = parsed;
      }
    } catch (e) {
      // keep default assignedByOptions
    }
    sortAlpha(assignedByOptions);
    try {
      const pwResult = await storageGet(PASSWORD_HASH_KEY);
      if (pwResult && pwResult.value) passwordHash = pwResult.value;
    } catch (e) {
      // no password set yet
    }
    try {
      const updatedResult = await storageGet(LOCAL_UPDATED_KEY);
      if (updatedResult && updatedResult.value) {
        localDataUpdatedAt = parseInt(updatedResult.value, 10) || 0;
      }
    } catch (e) {
      // no timestamp recorded yet
    }
    try {
      const lastExportResult = await storageGet(LAST_EXPORT_KEY);
      if (lastExportResult && lastExportResult.value) lastExportAt = parseInt(lastExportResult.value, 10) || 0;
    } catch (e) {
      // no export recorded yet
    }
    try {
      const reminderEmailResult = await storageGet(REMINDER_EMAIL_KEY);
      if (reminderEmailResult && reminderEmailResult.value) reminderEmailInput.value = reminderEmailResult.value;
    } catch (e) {
      // no saved email yet
    }
    try {
      const archResult = await storageGet(ARCHIVE_KEY);
      if (archResult && archResult.value) {
        const a = JSON.parse(archResult.value);
        if (Array.isArray(a)) archivedTasks = a;
      }
    } catch (e) {
      // no archive yet
    }
    updateFooterStatus();
    populateCategorySelect();
    renderCategoryList();
    populateAssigneeChecklist();
    renderAssigneeList();
    populateAssignedBySelect();
    renderAssignedByList();
    updateSecurityUI();
    updateEncryptionUI();
    // the passphrase already guards an encrypted list, so don't ask for the password as well
    if (passwordHash && !encryptionOn()) {
      showLock();
    }
    render();
    document.documentElement.classList.remove('booting');
    if (!passwordHash || encryptionOn()) {
      maybeShowDueSummary();
    }
  }

  async function saveCategories() {
    await queuedStorageSet(CATEGORIES_KEY, JSON.stringify(categories));
  }

  async function saveAssignees() {
    await queuedStorageSet(ASSIGNEES_KEY, JSON.stringify(assignees));
  }

  async function saveAssignedByOptions() {
    await queuedStorageSet(ASSIGNED_BY_KEY, JSON.stringify(assignedByOptions));
  }

  let saveInFlight = false;
  let savePending = false;

  async function save() {
    if (saveInFlight) {
      savePending = true;
      return;
    }
    saveInFlight = true;
    try {
      localDataUpdatedAt = Date.now();
      stampUpdated();
      await queuedStorageSet(STORAGE_KEY, JSON.stringify(todos));
      await queuedStorageSet(LOCAL_UPDATED_KEY, String(localDataUpdatedAt));
      showSavedNote();
    } finally {
      saveInFlight = false;
      if (savePending) {
        savePending = false;
        save();
      }
    }
  }

  // the task pop-up's "Saved" note; the element is rebuilt on every render, so look it up each time
  let savedNoteTimer = null;
  function showSavedNote() {
    const el = document.getElementById('savedNote');
    if (!el) return;
    el.textContent = '✓ Saved';
    el.classList.add('just-saved');
    clearTimeout(savedNoteTimer);
    savedNoteTimer = setTimeout(() => {
      const now = document.getElementById('savedNote');
      if (now) { now.textContent = '✓ Changes save automatically'; now.classList.remove('just-saved'); }
    }, 2000);
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedSave = debounce(save, 600);

  function getGroupInfo(item, sortField) {
    if (sortField === 'priority') {
      const p = item.priority || 'medium';
      return { key: p, label: p.charAt(0).toUpperCase() + p.slice(1) + ' Priority' };
    }
    if (sortField === 'category') {
      const c = item.category || '';
      return { key: c, label: c || 'No Category' };
    }
    if (sortField === 'due') {
      const d = item.dueDate || '';
      return { key: d, label: d ? formatDate(d) : 'No Due Date' };
    }
    if (sortField === 'assignee') {
      const list = item.assignees || (item.assignedTo ? [item.assignedTo] : []);
      const a = list.join(', ');
      return { key: a, label: a || 'Unassigned' };
    }
    return null;
  }

  function render() {
    listEl.innerHTML = '';
    const prevEditScroll = taskEditBody.scrollTop;
    taskEditBody.innerHTML = '';
    taskEditFooter.innerHTML = '';
    let editingItem = null;

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortComparators = {
      priority: (a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'],
      due: (a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      },
      category: (a, b) => {
        const catA = (a.category || '').toLowerCase();
        const catB = (b.category || '').toLowerCase();
        if (!catA && !catB) return 0;
        if (!catA) return 1;
        if (!catB) return -1;
        return catA.localeCompare(catB);
      },
      assignee: (a, b) => {
        const asA = ((a.assignees && a.assignees.join(', ')) || a.assignedTo || '').toLowerCase();
        const asB = ((b.assignees && b.assignees.join(', ')) || b.assignedTo || '').toLowerCase();
        if (!asA && !asB) return 0;
        if (!asA) return 1;
        if (!asB) return -1;
        return asA.localeCompare(asB);
      },
      name: (a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    };
    const todayStr = todayDateString();
    const visible = todos
      .filter(t => {
        // Overdue/Due Today filters match by date alone, including tasks that
        // are currently pending or sleeping - being asleep doesn't make a
        // task any less overdue, so it shouldn't be hidden from this view.
        if (page === 'active' && filterMode === 'dueToday') return !t.done && t.dueDate === todayStr;
        if (page === 'active' && filterMode === 'overdue') return !t.done && isPastDue(t.dueDate);
        if (page === 'active' && filterMode === 'stale') return isStale(t);
        if (page === 'today') return isTodayTask(t);
        if (page === 'done') return t.done;
        if (page === 'pending') return !t.done && t.pending;
        return !t.done && !t.pending;
      })
      .filter(t => {
        if (!searchTerm) return true;
        const hay = [t.text, t.category, (t.assignees || []).join(' '), t.assignedTo, t.assignedBy,
          (t.subtasks || []).map(x => x.text).join(' ')].join(' ').toLowerCase();
        return searchTerm.split(/\s+/).every(w => hay.includes(w));
      })
      .sort(sortComparators[sortBy] || sortComparators.priority);

    const filterIndicator = document.getElementById('filterIndicator');
    const filterIndicatorText = document.getElementById('filterIndicatorText');
    if (page === 'active' && filterMode) {
      filterIndicator.style.display = 'flex';
      const filterNames = { dueToday: 'Due today', overdue: 'Overdue', stale: 'Not touched in ' + STALE_DAYS + '+ days' };
      filterIndicatorText.textContent = 'Showing: ' + filterNames[filterMode] + ' (' + visible.length + ')';
    } else {
      filterIndicator.style.display = 'none';
    }

    document.getElementById('dueTodayStat').classList.toggle('filter-active', filterMode === 'dueToday');
    document.getElementById('overdueStat').classList.toggle('filter-active', filterMode === 'overdue');
    document.getElementById('dueTodayTopTrigger').classList.toggle('filter-active', filterMode === 'dueToday');
    document.getElementById('overdueTopTrigger').classList.toggle('filter-active', filterMode === 'overdue');
    document.getElementById('staleTrigger').classList.toggle('filter-active', filterMode === 'stale');

    listHeader.style.display = visible.length === 0 ? 'none' : 'grid';
    listHeader.classList.toggle('grid-done', page === 'done');
    lhCompleted.style.display = page === 'done' ? 'block' : 'none';
    listHeader.classList.toggle('grid-pending', page === 'pending');
    lhSleep.style.display = page === 'pending' ? 'block' : 'none';

    if (visible.length === 0) {
      emptyMsg.textContent = searchTerm
        ? 'No tasks match "' + searchInput.value.trim() + '".'
        : page === 'today'
        ? 'Nothing overdue, due today or starred. Star a task (☆ in its window) to add it here, or see the To-do tab for everything else.'
        : page === 'active'
        ? (filterMode ? 'No tasks match this filter.' : 'Nothing on the list. Click + New Task (or press N) to add one.')
        : page === 'pending'
          ? 'No pending tasks.'
          : 'No completed tasks yet.';
      emptyMsg.style.display = 'block';
    } else {
      emptyMsg.style.display = 'none';
      let previousGroupKey = null;
      visible.forEach((item, idx) => {
        const group = getGroupInfo(item, sortBy);
        if (group && group.key !== previousGroupKey) {
          const divider = document.createElement('li');
          divider.className = 'group-divider' + (idx === 0 ? ' first' : '');
          const dividerLabel = document.createElement('span');
          dividerLabel.textContent = group.label;
          divider.appendChild(dividerLabel);
          listEl.appendChild(divider);
          previousGroupKey = group.key;
        }

        const li = document.createElement('li');
        const isDueToday = !item.done && item.dueDate === todayDateString();
        const isRowOverdue = !item.done && isPastDue(item.dueDate);
        li.className = 'item' + (item.done ? ' done' : '') + (isDueToday ? ' due-today' : '') + (isRowOverdue ? ' overdue-row' : '') +
          (selectMode && selectedIds.has(item.id) ? ' selected' : '');
        li.dataset.id = item.id;
        li.dataset.group = group ? String(group.key) : '';
        li.draggable = !expandedIds.has(item.id) && !selectMode;

        const box = document.createElement('div');
        box.className = 'box';
        box.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';
        box.setAttribute('role', 'checkbox');
        box.setAttribute('aria-checked', item.done ? 'true' : 'false');
        box.setAttribute('aria-label', (item.done ? 'Mark not done: ' : 'Mark done: ') + item.text);
        box.addEventListener('click', () => (selectMode ? toggleSelected(item.id) : toggle(item.id)));

        const taskText = document.createElement('div');
        taskText.className = 'task-text' + (item.priority === 'high' ? ' high-priority' : '');
        if (item.starred && !item.done) {
          const star = document.createElement('span');
          star.className = 'star-mark';
          star.textContent = '★ ';
          star.title = 'Starred for Today';
          taskText.appendChild(star);
        }
        const taskTextLabel = document.createElement('span');
        taskTextLabel.textContent = item.text;
        taskText.appendChild(taskTextLabel);
        const realSubtasks = (item.subtasks || []).filter(s => s.type !== 'note');
        if (realSubtasks.length) {
          const doneCount = realSubtasks.filter(s => s.done).length;
          const progress = document.createElement('span');
          progress.className = 'subtask-progress' + (doneCount === realSubtasks.length ? ' all-done' : '');
          progress.textContent = '✓ ' + doneCount + '/' + realSubtasks.length;
          progress.title = doneCount + ' of ' + realSubtasks.length + ' subtasks done';
          taskText.appendChild(progress);
        }

        const categoryCell = document.createElement('div');
        categoryCell.className = 'cell cell-category';
        if (item.category) {
          const categoryTag = document.createElement('span');
          categoryTag.className = 'category-tag';
          categoryTag.textContent = item.category;
          categoryCell.appendChild(categoryTag);
        }
        if (!item.done && item.pending && (page === 'active' || page === 'today')) {
          const sleepTag = document.createElement('span');
          sleepTag.className = 'category-tag sleep-tag';
          sleepTag.textContent = item.snoozeUntil ? ('\u263E Asleep till ' + toUKDateShort(item.snoozeUntil)) : '\u23F8 Pending';
          categoryCell.appendChild(sleepTag);
        }
        if (!item.done && !item.pending && item.wokeUp && (page === 'active' || page === 'today')) {
          const wokeTag = document.createElement('span');
          wokeTag.className = 'category-tag woke-tag';
          wokeTag.textContent = '⏰ Woke up' + (item.wokeAt ? ' ' + toUKDateShort(item.wokeAt) : '');
          wokeTag.title = 'This task has woken up from sleep. Click to dismiss this marker.';
          wokeTag.addEventListener('click', e => {
            e.stopPropagation();
            item.wokeUp = false;
            save();
            render();
          });
          categoryCell.appendChild(wokeTag);
        }

        const itemAssignees = item.assignees || (item.assignedTo ? [item.assignedTo] : []);
        const assigneeCell = document.createElement('div');
        assigneeCell.className = 'cell cell-assignee';
        if (itemAssignees.length > 0) {
          const assigneeTag = document.createElement('span');
          assigneeTag.className = 'category-tag';
          assigneeTag.textContent = itemAssignees.join(', ');
          assigneeTag.title = itemAssignees.join(', ');
          assigneeCell.appendChild(assigneeTag);
        }

        const dueCell = document.createElement('div');
        dueCell.className = 'cell cell-due';
        if (item.dueDate) {
          const isOverdue = !item.done && isPastDue(item.dueDate);
          dueCell.className += ' created' + (isOverdue ? ' overdue' : '');
          dueCell.textContent = item.done ? formatDate(item.dueDate) : formatDue(item.dueDate);
        }

        const priorityTag = document.createElement('span');
        const priority = item.priority || 'medium';
        priorityTag.className = 'priority-tag ' + priority;
        priorityTag.textContent = priority;

        const stamp = document.createElement('div');
        stamp.className = 'stamp';
        stamp.textContent = 'done';

        const row = document.createElement('div');
        row.className = 'row';
        row.appendChild(box);
        row.appendChild(taskText);
        row.appendChild(categoryCell);
        row.appendChild(assigneeCell);
        row.appendChild(dueCell);

        if (page === 'done') {
          row.classList.add('grid-done');
          const completedCell = document.createElement('div');
          completedCell.className = 'cell cell-completed';
          if (item.done && item.completedAt) {
            completedCell.className += ' created';
            completedCell.textContent = 'Done ' + formatDate(item.completedAt);
          }
          row.appendChild(completedCell);
        }

        if (page === 'pending') {
          row.classList.add('grid-pending');
          const sleepCell = document.createElement('div');
          sleepCell.className = 'cell cell-sleep' + (item.snoozeUntil ? '' : ' no-timer');
          sleepCell.textContent = item.snoozeUntil ? toUKDateShort(item.snoozeUntil) : 'No timer';
          if (item.snoozeUntil) sleepCell.title = 'Wakes up on ' + toUKDateShort(item.snoozeUntil);
          row.appendChild(sleepCell);
        }

        row.appendChild(priorityTag);
        row.appendChild(stamp);
        li.appendChild(row);

        taskText.addEventListener('click', () => (selectMode ? toggleSelected(item.id) : toggleExpanded(item.id)));

        if (expandedIds.has(item.id)) {
          const panel = document.createElement('div');
          panel.className = 'notes-panel';

          const editFields = document.createElement('div');
          editFields.className = 'edit-fields';

          const editName = document.createElement('input');
          editName.type = 'text';
          editName.className = 'edit-name';
          editName.value = item.text;
          editName.maxLength = 280;
          editName.addEventListener('input', () => {
            item.text = editName.value;
            taskTextLabel.textContent = editName.value;
            taskEditTitle.textContent = editName.value;
            debouncedSave();
          });

          const editMetaRow = document.createElement('div');
          editMetaRow.className = 'edit-meta-row';

          const editDue = document.createElement('input');
          editDue.type = 'date';
          editDue.className = 'edit-due';
          editDue.value = item.dueDate || '';
          editDue.addEventListener('change', () => {
            item.dueDate = editDue.value || '';
            save();
            render();
          });

          const editPriority = document.createElement('select');
          editPriority.className = 'edit-priority';
          ['high', 'medium', 'low'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
            if ((item.priority || 'medium') === p) opt.selected = true;
            editPriority.appendChild(opt);
          });
          editPriority.addEventListener('change', () => {
            item.priority = editPriority.value;
            save();
            render();
          });

          const editCategory = document.createElement('select');
          editCategory.className = 'edit-category';
          const noCatOpt = document.createElement('option');
          noCatOpt.value = '';
          noCatOpt.textContent = 'No category';
          if (!item.category) noCatOpt.selected = true;
          editCategory.appendChild(noCatOpt);
          categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (item.category === cat) opt.selected = true;
            editCategory.appendChild(opt);
          });
          editCategory.addEventListener('change', () => {
            item.category = editCategory.value;
            save();
            render();
          });

          if (!item.assignees) {
            item.assignees = item.assignedTo ? [item.assignedTo] : [];
          }

          const editAssigneeField = document.createElement('div');
          editAssigneeField.className = 'assignee-field';

          const editAssigneeLabel = document.createElement('div');
          editAssigneeLabel.className = 'assignee-field-label';
          editAssigneeLabel.textContent = 'Assigned to';

          const editAssigneeChecklist = document.createElement('div');
          editAssigneeChecklist.className = 'assignee-checklist';

          if (assignees.length === 0) {
            const noneMsg = document.createElement('div');
            noneMsg.className = 'assignee-checklist-empty';
            noneMsg.textContent = 'No one added yet (Settings \u2192 Assigned To).';
            editAssigneeChecklist.appendChild(noneMsg);
          }

          assignees.forEach(person => {
            const label = document.createElement('label');
            label.className = 'assignee-checkbox-row';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.assignees.includes(person);
            checkbox.addEventListener('change', () => {
              if (checkbox.checked) {
                if (!item.assignees.includes(person)) item.assignees.push(person);
              } else {
                item.assignees = item.assignees.filter(p => p !== person);
              }
              item.assignedTo = item.assignees[0] || '';
              save();
              render();
            });

            const nameSpan = document.createElement('span');
            nameSpan.textContent = person;

            label.appendChild(checkbox);
            label.appendChild(nameSpan);
            editAssigneeChecklist.appendChild(label);
          });

          editAssigneeField.appendChild(editAssigneeLabel);
          editAssigneeField.appendChild(editAssigneeChecklist);

          const editAssignedByField = document.createElement('div');
          editAssignedByField.className = 'assignee-field';

          const editAssignedByLabel = document.createElement('div');
          editAssignedByLabel.className = 'assignee-field-label';
          editAssignedByLabel.textContent = 'Assigned by / from';

          const editAssignedBy = document.createElement('select');
          editAssignedBy.className = 'edit-category';
          const noAssignedByOpt = document.createElement('option');
          noAssignedByOpt.value = '';
          noAssignedByOpt.textContent = 'Unassigned';
          if (!item.assignedBy) noAssignedByOpt.selected = true;
          editAssignedBy.appendChild(noAssignedByOpt);
          assignedByOptions.forEach(person => {
            const opt = document.createElement('option');
            opt.value = person;
            opt.textContent = person;
            if (item.assignedBy === person) opt.selected = true;
            editAssignedBy.appendChild(opt);
          });
          editAssignedBy.addEventListener('change', () => {
            item.assignedBy = editAssignedBy.value;
            save();
            render();
          });

          editAssignedByField.appendChild(editAssignedByLabel);
          editAssignedByField.appendChild(editAssignedBy);

          const editRepeat = document.createElement('select');
          editRepeat.className = 'edit-category';
          [['', 'No repeat'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = label;
            if ((item.repeat || '') === v) opt.selected = true;
            editRepeat.appendChild(opt);
          });
          editRepeat.title = 'Repeating tasks need a due date';
          editRepeat.addEventListener('change', () => {
            item.repeat = editRepeat.value;
            if (item.repeat && !item.dueDate) showToast('Add a due date so the repeat knows when the next one is due.');
            save();
            render();
          });

          const starBtn = document.createElement('button');
          starBtn.type = 'button';
          starBtn.className = 'star-toggle' + (item.starred ? ' on' : '');
          starBtn.textContent = item.starred ? '★ Starred for Today' : '☆ Star for Today';
          starBtn.setAttribute('aria-pressed', item.starred ? 'true' : 'false');
          starBtn.addEventListener('click', () => {
            item.starred = !item.starred;
            save();
            render();
          });

          // every field gets a visible label. The wrapper is a div, not a <label>: some browsers turn a
          // click inside a label-wrapped date box into two clicks, opening and instantly closing the calendar.
          const field = (labelText, el) => {
            const wrap = document.createElement('div');
            wrap.className = 'field';
            const cap = document.createElement('label');
            cap.className = 'field-label';
            cap.textContent = labelText;
            if (!el.id) el.id = 'f' + uid();
            cap.htmlFor = el.id;
            wrap.appendChild(cap);
            wrap.appendChild(el);
            return wrap;
          };

          editMetaRow.appendChild(field('Due date', editDue));
          editMetaRow.appendChild(field('Priority', editPriority));
          editMetaRow.appendChild(field('Category', editCategory));
          editMetaRow.appendChild(field('Repeat', editRepeat));

          const nameRow = document.createElement('div');
          nameRow.className = 'edit-name-row';
          nameRow.appendChild(field('Task', editName));
          nameRow.appendChild(starBtn);

          editFields.appendChild(nameRow);
          editFields.appendChild(editMetaRow);
          editFields.appendChild(editAssigneeField);
          editFields.appendChild(editAssignedByField);

          if (!item.subtasks) {
            item.subtasks = item.notesList
              ? item.notesList.map(n => ({ id: uid(), text: n.text, done: false, createdAt: n.createdAt || item.createdAt }))
              : (item.notes ? [{ id: uid(), text: item.notes, done: false, createdAt: item.createdAt }] : []);
          }

          const subtaskListTitle = document.createElement('div');
          subtaskListTitle.className = 'subtask-list-title';
          subtaskListTitle.textContent = 'Subtasks / Notes';

          const subtaskList = document.createElement('div');
          subtaskList.className = 'subtask-list';

          item.subtasks.forEach(sub => {
            const isNote = sub.type === 'note';
            const subRow = document.createElement('div');
            subRow.className = 'subtask-item' + (sub.done ? ' done' : '') + (isNote ? ' note-entry' : '');

            let subBox = null;
            if (isNote) {
              subBox = document.createElement('div');
              subBox.className = 'subtask-note-icon';
              subBox.textContent = 'NOTE';
              subBox.title = 'This is a note (no checkbox)';
            } else {
              subBox = document.createElement('div');
              subBox.className = 'subtask-box';
              subBox.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';
              subBox.addEventListener('click', () => {
                sub.done = !sub.done;
                save();
                render();
              });
            }

            const subText = document.createElement('div');
            subText.className = 'subtask-text';
            subText.textContent = sub.text;
            subText.title = 'Click to edit';
            subText.addEventListener('click', () => {
              const editInput = document.createElement('textarea');
              editInput.className = 'subtask-edit-input';
              editInput.maxLength = 5000;
              editInput.rows = 3;
              editInput.value = sub.text;
              subRow.replaceChild(editInput, subText);
              editInput.focus();
              editInput.select();

              const commit = () => {
                const value = editInput.value.trim();
                if (value) sub.text = value;
                save();
                render();
              };
              editInput.addEventListener('blur', commit);
              editInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editInput.blur(); }
                if (e.key === 'Escape') { e.stopPropagation(); editInput.value = sub.text; editInput.blur(); }
              });
            });

            const subDate = document.createElement('div');
            subDate.className = 'subtask-date';
            subDate.textContent = formatDateDDMM(sub.createdAt || item.createdAt);
            subDate.title = 'Date created';

            const isConfirming = confirmingSubtaskDelete.has(sub.id);

            const subTypeToggle = document.createElement('button');
            subTypeToggle.type = 'button';
            subTypeToggle.className = 'subtask-type-toggle';
            subTypeToggle.title = isNote ? 'Change to Subtask (adds a checkbox)' : 'Change to Note (removes the checkbox)';
            subTypeToggle.textContent = isNote ? '\u2192 Subtask' : '\u2192 Note';
            subTypeToggle.addEventListener('click', () => {
              sub.type = isNote ? 'subtask' : 'note';
              if (sub.type === 'note') sub.done = false;
              save();
              render();
            });

            const subDelete = document.createElement('button');
            subDelete.type = 'button';
            subDelete.className = 'subtask-delete' + (isConfirming ? ' confirming' : '');
            subDelete.setAttribute('aria-label', isConfirming ? 'Confirm delete subtask' : 'Delete subtask');
            subDelete.title = isConfirming ? 'Click again to delete' : 'Delete subtask';
            subDelete.textContent = isConfirming ? 'Confirm?' : '\u2715';
            subDelete.addEventListener('click', () => {
              if (confirmingSubtaskDelete.has(sub.id)) {
                item.subtasks = item.subtasks.filter(s => s.id !== sub.id);
                confirmingSubtaskDelete.delete(sub.id);
                save();
                render();
              } else {
                confirmingSubtaskDelete.add(sub.id);
                render();
              }
            });

            let subCancel = null;
            if (isConfirming) {
              subCancel = document.createElement('button');
              subCancel.type = 'button';
              subCancel.className = 'subtask-cancel-delete';
              subCancel.textContent = 'Cancel';
              subCancel.addEventListener('click', () => {
                confirmingSubtaskDelete.delete(sub.id);
                render();
              });
            }

            subRow.appendChild(subDate);
            subRow.appendChild(subBox);
            subRow.appendChild(subText);
            subRow.appendChild(subTypeToggle);
            subRow.appendChild(subDelete);
            if (subCancel) subRow.appendChild(subCancel);
            subtaskList.appendChild(subRow);
          });

          if (item.subtasks.length === 0) {
            const emptySub = document.createElement('div');
            emptySub.className = 'subtask-empty';
            emptySub.textContent = 'No Subtasks / Notes yet.';
            subtaskList.appendChild(emptySub);
          }

          const addSubtaskRow = document.createElement('div');
          addSubtaskRow.className = 'add-subtask-row';

          const entryTypeRow = document.createElement('div');
          entryTypeRow.className = 'entry-type-row';

          const currentEntryType = addEntryTypeByItem[item.id] || 'subtask';

          const subtaskTypeBtn = document.createElement('button');
          subtaskTypeBtn.type = 'button';
          subtaskTypeBtn.className = 'entry-type-btn' + (currentEntryType === 'subtask' ? ' selected' : '');
          subtaskTypeBtn.textContent = 'Subtask';

          const noteTypeBtn = document.createElement('button');
          noteTypeBtn.type = 'button';
          noteTypeBtn.className = 'entry-type-btn' + (currentEntryType === 'note' ? ' selected' : '');
          noteTypeBtn.textContent = 'Note';

          subtaskTypeBtn.addEventListener('click', () => {
            addEntryTypeByItem[item.id] = 'subtask';
            subtaskTypeBtn.classList.add('selected');
            noteTypeBtn.classList.remove('selected');
          });
          noteTypeBtn.addEventListener('click', () => {
            addEntryTypeByItem[item.id] = 'note';
            noteTypeBtn.classList.add('selected');
            subtaskTypeBtn.classList.remove('selected');
          });

          entryTypeRow.appendChild(subtaskTypeBtn);
          entryTypeRow.appendChild(noteTypeBtn);

          const addSubtaskInput = document.createElement('textarea');
          addSubtaskInput.placeholder = 'Add a subtask or note... (Enter to add, Shift+Enter for a new line, or Save)';
          addSubtaskInput.className = 'add-subtask-input';
          addSubtaskInput.maxLength = 5000;
          addSubtaskInput.rows = 4;
          addSubtaskInput.value = subtaskDrafts[item.id] || '';

          addSubtaskInput.addEventListener('input', () => {
            if (addSubtaskInput.value) {
              subtaskDrafts[item.id] = addSubtaskInput.value;
            } else {
              delete subtaskDrafts[item.id];
            }
          });

          const addSubtask = () => {
            const value = addSubtaskInput.value.trim();
            if (!value) return;
            const entryType = addEntryTypeByItem[item.id] || 'subtask';
            item.subtasks.push({ id: uid(), text: value, done: false, type: entryType, createdAt: Date.now() });
            addSubtaskInput.value = '';
            delete subtaskDrafts[item.id];
            save();
            render();
          };

          addSubtaskInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addSubtask();
            }
          });

          addSubtaskRow.appendChild(entryTypeRow);
          addSubtaskRow.appendChild(addSubtaskInput);

          const panelFooter = document.createElement('div');
          panelFooter.className = 'notes-footer';

          const isConfirmingTaskDelete = confirmingTaskDelete.has(item.id);

          const remove = document.createElement('button');
          remove.className = 'remove' + (isConfirmingTaskDelete ? ' confirming' : '');
          remove.setAttribute('aria-label', isConfirmingTaskDelete ? 'Confirm delete task' : 'Delete task');
          remove.title = isConfirmingTaskDelete ? 'Click again to delete' : 'Delete task';
          remove.textContent = isConfirmingTaskDelete ? 'Confirm?' : 'Delete task';
          remove.addEventListener('click', () => {
            if (confirmingTaskDelete.has(item.id)) {
              removeItem(item.id);
            } else {
              confirmingTaskDelete.add(item.id);
              render();
            }
          });

          let cancelTaskDeleteBtn = null;
          if (isConfirmingTaskDelete) {
            cancelTaskDeleteBtn = document.createElement('button');
            cancelTaskDeleteBtn.type = 'button';
            cancelTaskDeleteBtn.className = 'cancel-task-delete';
            cancelTaskDeleteBtn.textContent = 'Cancel';
            cancelTaskDeleteBtn.addEventListener('click', () => {
              confirmingTaskDelete.delete(item.id);
              render();
            });
          }

          // keep any typed-but-not-added subtask/note, then save
          const commitPending = () => {
            const pendingSubtask = addSubtaskInput.value.trim();
            if (pendingSubtask) {
              const entryType = addEntryTypeByItem[item.id] || 'subtask';
              item.subtasks.push({ id: uid(), text: pendingSubtask, done: false, type: entryType, createdAt: Date.now() });
              addSubtaskInput.value = '';
              delete subtaskDrafts[item.id];
            }
            save();
          };

          // Save keeps the window open; Done saves and closes it
          const saveTaskBtn = document.createElement('button');
          saveTaskBtn.type = 'button';
          saveTaskBtn.className = 'save-only-task';
          saveTaskBtn.textContent = 'Save';
          saveTaskBtn.addEventListener('click', () => {
            commitPending();
            render();
            showSavedNote();
          });

          const doneTaskBtn = document.createElement('button');
          doneTaskBtn.type = 'button';
          doneTaskBtn.className = 'save-task';
          doneTaskBtn.textContent = 'Done';
          doneTaskBtn.addEventListener('click', () => {
            commitPending();
            expandedIds.clear();
            render();
          });

          const savedNote = document.createElement('span');
          savedNote.className = 'saved-note';
          savedNote.id = 'savedNote';
          savedNote.textContent = '✓ Changes save automatically';

          const spacer = document.createElement('span');
          spacer.className = 'footer-spacer';

          let pendingToggleBtn = null;
          let markCompleteBtn = null;
          let sleep1WeekBtn = null;
          let sleepUntilInput = null;
          let snoozeInfo = null;
          if (!item.done) {
            pendingToggleBtn = document.createElement('button');
            pendingToggleBtn.type = 'button';
            pendingToggleBtn.className = 'pending-toggle';
            pendingToggleBtn.textContent = item.pending ? 'Move to Active' : 'Move to Pending';
            pendingToggleBtn.addEventListener('click', () => {
              item.pending = !item.pending;
              item.wokeUp = false;
              if (!item.pending) item.snoozeUntil = null;
              save();
              toggleExpanded(item.id);
            });

            if (item.pending) {
              markCompleteBtn = document.createElement('button');
              markCompleteBtn.type = 'button';
              markCompleteBtn.className = 'mark-complete-btn';
              markCompleteBtn.textContent = 'Move to Complete';
              markCompleteBtn.addEventListener('click', () => {
                toggle(item.id);
              });

              if (item.snoozeUntil) {
                snoozeInfo = document.createElement('span');
                snoozeInfo.className = 'snooze-info';
                snoozeInfo.textContent = 'Sleeping till ' + toUKDateShort(item.snoozeUntil);
              }
            } else {
              sleep1WeekBtn = document.createElement('button');
              sleep1WeekBtn.type = 'button';
              sleep1WeekBtn.className = 'sleep-toggle';
              sleep1WeekBtn.textContent = 'Sleep 1 Week';
              sleep1WeekBtn.addEventListener('click', () => {
                item.pending = true;
                item.wokeUp = false;
                item.snoozeUntil = addDaysToToday(7);
                save();
                toggleExpanded(item.id);
              });

              sleepUntilInput = document.createElement('input');
              sleepUntilInput.type = 'date';
              sleepUntilInput.className = 'sleep-until-input';
              sleepUntilInput.title = 'Sleep until a chosen date';
              sleepUntilInput.min = addDaysToToday(1);
              sleepUntilInput.addEventListener('change', () => {
                if (!sleepUntilInput.value) return;
                item.pending = true;
                item.wokeUp = false;
                item.snoozeUntil = sleepUntilInput.value;
                save();
                toggleExpanded(item.id);
              });
            }
          }

          // pinned footer: Delete apart on the left, task actions in the middle, Done on the right
          if (snoozeInfo) panelFooter.appendChild(snoozeInfo);
          panelFooter.appendChild(remove);
          if (cancelTaskDeleteBtn) panelFooter.appendChild(cancelTaskDeleteBtn);
          panelFooter.appendChild(spacer);
          if (pendingToggleBtn) panelFooter.appendChild(pendingToggleBtn);
          if (sleep1WeekBtn) panelFooter.appendChild(sleep1WeekBtn);
          if (sleepUntilInput) panelFooter.appendChild(sleepUntilInput);
          if (markCompleteBtn) panelFooter.appendChild(markCompleteBtn);
          panelFooter.appendChild(savedNote);
          panelFooter.appendChild(saveTaskBtn);
          panelFooter.appendChild(doneTaskBtn);

          panel.appendChild(editFields);
          panel.appendChild(subtaskListTitle);
          panel.appendChild(subtaskList);
          panel.appendChild(addSubtaskRow);
          taskEditBody.appendChild(panel);
          taskEditFooter.appendChild(panelFooter);
          editingItem = item;
          li.classList.add('editing-row');
        }

        listEl.appendChild(li);
      });
    }

    const remaining = todos.filter(t => !t.done && !t.pending).length;
    const pendingCount = todos.filter(t => !t.done && t.pending).length;
    const completed = todos.filter(t => t.done).length;
    const todayCount = todos.filter(isTodayTask).length;
    countLabel.textContent = page === 'today'
      ? todayCount + (todayCount === 1 ? ' item for today' : ' items for today')
      : page === 'active'
      ? remaining + (remaining === 1 ? ' item left' : ' items left')
      : page === 'pending'
        ? pendingCount + (pendingCount === 1 ? ' item pending' : ' items pending')
        : completed + (completed === 1 ? ' item completed' : ' items completed');

    const canAdd = page === 'active' || page === 'today';
    newTaskOverlay.classList.toggle('open', canAdd && addFormOpen);
    if (editingItem) {
      taskEditTitle.textContent = editingItem.text;
      taskEditOverlay.classList.add('open');
      if (lastEditedId === editingItem.id) taskEditBody.scrollTop = prevEditScroll;
      lastEditedId = editingItem.id;
    } else {
      // the open task left this view (completed, deleted, or filtered out): forget it
      // so it doesn't pop up again later on another tab
      expandedIds.clear();
      taskEditOverlay.classList.remove('open');
      lastEditedId = null;
    }
    document.querySelector('.quick-add').style.display = canAdd ? 'flex' : 'none';
    updateBulkBar();
    clearBtn.style.display = page === 'done' && completed > 0 ? 'inline' : 'none';
    exportBtn.style.display = page === 'done' && completed > 0 ? 'inline' : 'none';

    updateSummary();
  }

  function updateSummary() {
    const openTasks = todos.filter(t => !t.done);
    const highCount = openTasks.filter(t => (t.priority || 'medium') === 'high').length;
    const mediumCount = openTasks.filter(t => (t.priority || 'medium') === 'medium').length;
    const lowCount = openTasks.filter(t => (t.priority || 'medium') === 'low').length;
    const today = todayDateString();
    const dueTodayCount = openTasks.filter(t => t.dueDate === today).length;
    const overdueCount = openTasks.filter(t => isPastDue(t.dueDate)).length;
    const pendingCount = openTasks.filter(t => t.pending).length;

    document.getElementById('highCount').textContent = highCount;
    document.getElementById('mediumCount').textContent = mediumCount;
    document.getElementById('lowCount').textContent = lowCount;
    document.getElementById('dueTodayCount').textContent = dueTodayCount;
    document.getElementById('dueTodayTopCount').textContent = dueTodayCount;
    document.getElementById('overdueCount').textContent = overdueCount;
    document.getElementById('overdueTopCount').textContent = overdueCount;
    document.getElementById('pendingSummaryCount').textContent = pendingCount;
    document.getElementById('pendingTopCount').textContent = pendingCount;
    document.getElementById('tabActiveCount').textContent = openTasks.length - pendingCount;
    document.getElementById('tabDoneCount').textContent = todos.length - openTasks.length;
    document.getElementById('tabTodayCount').textContent = todos.filter(isTodayTask).length;
    document.getElementById('cardOverdueCount').textContent = overdueCount;
    document.getElementById('cardDueCount').textContent = dueTodayCount;
    document.getElementById('cardTodayCount').textContent = todos.filter(isTodayTask).length;
    const staleCount = todos.filter(isStale).length;
    document.getElementById('staleCount').textContent = staleCount;
    document.getElementById('staleTrigger').style.display = staleCount || filterMode === 'stale' ? '' : 'none';

    document.getElementById('dueTodayStat').classList.toggle('flash', dueTodayCount > 0);
    document.getElementById('overdueStat').classList.toggle('flash', overdueCount > 0);
    document.getElementById('dueTodayTopTrigger').classList.toggle('flash', dueTodayCount > 0);
    document.getElementById('overdueTopTrigger').classList.toggle('flash', overdueCount > 0);
  }

  function setPage(next) {
    page = next;
    if (page !== 'active') filterMode = null;
    if (selectMode) exitSelectMode();
    tabToday.classList.toggle('active', page === 'today');
    tabActive.classList.toggle('active', page === 'active');
    tabPending.classList.toggle('active', page === 'pending');
    tabDone.classList.toggle('active', page === 'done');
    [tabToday, tabActive, tabPending, tabDone].forEach(b => b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false'));
    render();
  }

  function getDueSummaryData() {
    const todayStr = todayDateString();
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();
    const weekEndTime = todayTime + 7 * 24 * 60 * 60 * 1000;

    const overdue = [];
    const dueToday = [];
    const dueThisWeek = [];

    todos.forEach(t => {
      if (t.done || !t.dueDate) return;
      if (t.dueDate === todayStr) {
        dueToday.push(t);
        return;
      }
      const d = new Date(t.dueDate + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      if (d.getTime() < todayTime) {
        overdue.push(t);
      } else if (d.getTime() <= weekEndTime) {
        dueThisWeek.push(t);
      }
    });

    const byDue = (a, b) => (a.dueDate || '').localeCompare(b.dueDate || '');
    overdue.sort(byDue);
    dueThisWeek.sort(byDue);

    return { overdue, dueToday, dueThisWeek };
  }

  function buildDueSummarySection(title, items, extraClass) {
    if (items.length === 0) return '';
    const rows = items.map(t =>
      '<li data-id="' + escapeHtml(t.id) + '" tabindex="0" title="Open this task"><span class="due-summary-task">' + escapeHtml(t.text) + '</span>' +
      '<span class="due-summary-date">' + escapeHtml(t.dueDate ? formatDue(t.dueDate) : '') + '</span></li>'
    ).join('');
    return '<div class="due-summary-section' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="due-summary-title">' + title + ' (' + items.length + ')</div>' +
      '<ul class="due-summary-list">' + rows + '</ul>' +
      '</div>';
  }

  // the Today list as a pop-up every time the app opens (the app itself opens on To-do).
  // On Mondays, once, it also lists tasks nobody has touched for a while and nudges for a backup.
  function maybeShowDueSummary() {
    const todayStr = todayDateString();
    const mondayKey = 'todo_monday_review_' + (new URLSearchParams(location.search).get('u') || '');
    let mondayShown = false;
    try { mondayShown = localStorage.getItem(mondayKey) === todayStr; } catch (e) { /* storage unavailable: show it */ }

    const { overdue, dueToday } = getDueSummaryData();
    const starred = todos.filter(t => !t.done && t.starred && !overdue.includes(t) && !dueToday.includes(t));
    const isMonday = new Date().getDay() === 1 && !mondayShown;
    const stale = isMonday ? todos.filter(isStale) : [];
    const backupDays = lastExportAt ? Math.floor((Date.now() - lastExportAt) / 86400000) : null;
    const needsBackup = isMonday && (backupDays === null || backupDays > 30);
    if (!overdue.length && !dueToday.length && !starred.length && !stale.length && !needsBackup) return;

    const staleSection = stale.length
      ? '<div class="due-summary-section"><div class="due-summary-title">Not touched in ' + STALE_DAYS + '+ days (' + stale.length + ')</div>' +
        '<p class="settings-hint">Worth a quick look: finish, sleep or update these.</p>' +
        '<ul class="due-summary-list">' + stale.slice(0, 15).map(t => '<li><span class="due-summary-task">' + escapeHtml(t.text) + '</span>' +
        '<span class="due-summary-date">' + escapeHtml(formatDate(t.updatedAt || t.createdAt)) + '</span></li>').join('') + '</ul></div>'
      : '';
    const backupSection = needsBackup
      ? '<div class="due-summary-section backup-nudge"><div class="due-summary-title">Backup</div>' +
        '<p class="settings-hint">' + (backupDays === null ? 'You haven\'t saved a CSV backup yet.' : 'Your last CSV backup was ' + backupDays + ' days ago.') +
        (encryptionOn() ? ' Your list is encrypted, so a backup is the only way back if the passphrase is forgotten.' : '') +
        ' <button type="button" class="link-btn" id="summaryExportBtn">Export now</button></p></div>'
      : '';

    const body = document.getElementById('dueSummaryBody');
    body.innerHTML =
      buildDueSummarySection('Overdue', overdue, 'overdue') +
      buildDueSummarySection('Due today', dueToday, 'due') +
      buildDueSummarySection('★ Starred', starred) +
      staleSection + backupSection;
    const exportNow = document.getElementById('summaryExportBtn');
    if (exportNow) exportNow.addEventListener('click', () => exportAllBtn.click());

    if (isMonday) { try { localStorage.setItem(mondayKey, todayStr); } catch (e) { /* ignore */ } }
    document.getElementById('dueSummaryDay').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    document.getElementById('dueSummaryOverlay').classList.add('open');
  }

  // tapping a task in the Today pop-up closes it and opens that task, on whichever tab it lives
  document.getElementById('dueSummaryBody').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const t = todos.find(x => x.id === li.dataset.id);
    if (!t) return;
    closeDueSummary();
    filterMode = null;
    setPage(t.done ? 'done' : t.pending ? 'pending' : 'active');
    toggleExpanded(t.id);
  });
  document.getElementById('dueSummaryBody').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('li[data-id]')) e.target.click();
  });
  document.getElementById('dueSummaryTodayBtn').addEventListener('click', () => {
    closeDueSummary();
    setPage('today');
  });

  function addItem() {
    const value = input.value.trim();
    if (!value) return;
    const priority = prioritySelect.value || 'medium';
    const dueDate = dueDateInput.value || '';
    const category = categorySelect.value || '';
    const taskAssignees = selectedAddAssignees.slice();
    const assignedTo = taskAssignees[0] || '';
    const assignedBy = assignedBySelect.value || '';
    const repeat = dueDate ? (repeatSelect.value || '') : '';
    // a new task added while looking at Today is starred, so it shows up there
    const starred = page === 'today';
    todos.push({ id: uid(), text: value, done: false, createdAt: Date.now(), priority, dueDate, category, assignedTo, assignees: taskAssignees, assignedBy, repeat, starred });
    repeatSelect.value = '';
    input.value = '';
    prioritySelect.value = 'medium';
    dueDateInput.value = '';
    categorySelect.value = '';
    selectedAddAssignees = [];
    populateAssigneeChecklist();
    assignedBySelect.value = '';
    addFormOpen = false;
    render();
    save();
  }

  // only one task is open (in the pop-up) at a time
  function toggleExpanded(id) {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.clear();
      expandedIds.add(id);
    }
    render();
  }

  function closeTaskEditWindow() {
    expandedIds.clear();
    render();
  }

  // ---------- select several tasks and act on them together ----------
  const bulkBar = document.getElementById('bulkBar');
  const selectBtn = document.getElementById('selectBtn');
  const bulkCategory = document.getElementById('bulkCategory');

  function toggleSelected(id) {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    render();
  }

  function enterSelectMode() {
    selectMode = true;
    selectedIds.clear();
    expandedIds.clear();
    render();
  }

  function exitSelectMode() {
    selectMode = false;
    selectedIds.clear();
    render();
  }

  function updateBulkBar() {
    document.body.classList.toggle('select-mode', selectMode);
    selectBtn.textContent = selectMode ? 'Cancel' : 'Select';
    selectBtn.setAttribute('aria-pressed', selectMode ? 'true' : 'false');
    bulkBar.classList.toggle('open', selectMode);
    const n = selectedIds.size;
    document.getElementById('bulkCount').textContent = n ? n + ' selected' : 'Tap tasks to select them';
    bulkBar.querySelectorAll('button[data-bulk]').forEach(b => { if (b.dataset.bulk !== 'cancel') b.disabled = !n; });
    bulkCategory.disabled = !n;
    if (bulkCategory.options.length !== categories.length + 2) {
      bulkCategory.innerHTML = '<option value="">Set category…</option><option value="__none">No category</option>' +
        categories.map(c => '<option>' + escapeHtml(c) + '</option>').join('');
    }
  }

  function bulkApply(label, change) {
    const chosen = todos.filter(t => selectedIds.has(t.id));
    if (!chosen.length) return;
    const snap = JSON.stringify(todos);
    chosen.forEach(change);
    selectMode = false;
    selectedIds.clear();
    render();
    save();
    showToast(label + ' ' + chosen.length + ' task' + (chosen.length === 1 ? '' : 's') + '.', () => {
      todos = JSON.parse(snap);
      render();
      save();
      showToast('Restored.');
    });
  }

  selectBtn.addEventListener('click', () => (selectMode ? exitSelectMode() : enterSelectMode()));
  bulkBar.addEventListener('click', e => {
    const b = e.target.closest('button[data-bulk]');
    if (!b) return;
    const action = b.dataset.bulk;
    if (action === 'cancel') return exitSelectMode();
    if (action === 'done') bulkApply('Completed', t => { if (!t.done) { t.done = true; t.pending = false; t.completedAt = Date.now(); spawnNextRepeat(t); } });
    if (action === 'pending') bulkApply('Moved to Pending', t => { t.done = false; t.completedAt = null; t.pending = true; t.wokeUp = false; });
    if (action === 'active') bulkApply('Moved to To-do', t => { t.done = false; t.completedAt = null; t.pending = false; t.snoozeUntil = null; });
    if (action === 'star') bulkApply('Starred', t => { t.starred = true; });
  });
  bulkCategory.addEventListener('change', () => {
    const v = bulkCategory.value;
    if (!v) return;
    bulkApply('Updated the category of', t => { t.category = v === '__none' ? '' : v; });
    bulkCategory.value = '';
  });
  document.getElementById('taskEditClose').addEventListener('click', closeTaskEditWindow);
  taskEditOverlay.addEventListener('click', e => {
    if (e.target === taskEditOverlay) closeTaskEditWindow();
  });

  function toggle(id) {
    const item = todos.find(t => t.id === id);
    if (item) {
      if (!item.done) {
        const openSubtasks = (item.subtasks || []).filter(s => s.type !== 'note' && !s.done);
        if (openSubtasks.length > 0) {
          showToast('This task still has ' + openSubtasks.length + ' open subtask' + (openSubtasks.length === 1 ? '' : 's') + '. Complete them first.');
          return;
        }
      }
      // ticking is easy to do by accident, so completing offers Undo (which also removes a repeat's next copy)
      const snap = item.done ? null : JSON.stringify(todos);
      item.done = !item.done;
      item.completedAt = item.done ? Date.now() : null;
      if (item.done) {
        item.pending = false;
        const next = spawnNextRepeat(item);
        showToast('Marked done.' + (next ? ' Next one due ' + formatDate(next) + '.' : ''), () => {
          todos = JSON.parse(snap);
          render();
          save();
          showToast('Restored.');
        });
      }
    }
    render();
    save();
  }

  function removeItem(id) {
    snapshotUndo('Task deleted.');
    todos = todos.filter(t => t.id !== id);
    confirmingTaskDelete.delete(id);
    expandedIds.delete(id);
    delete subtaskDrafts[id];
    delete addEntryTypeByItem[id];
    render();
    save();
  }

  clearBtn.addEventListener('click', () => {
    const n = todos.filter(t => t.done).length;
    if (n) snapshotUndo('Cleared ' + n + ' completed task' + (n === 1 ? '' : 's') + '.');
    todos = todos.filter(t => !t.done);
    render();
    save();
  });

  function csvEscape(value) {
    const str = String(value == null ? '' : value);
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else if (char === '\r') {
        // ignore, handled with the following \n
      } else {
        field += char;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }

  function parseISODateToTimestamp(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const t = new Date(value + 'T00:00:00').getTime();
    return isNaN(t) ? null : t;
  }

  function importTasksFromCsv(text) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      showImportStatus('No data found in that file.', 'error');
      return;
    }

    const headers = parsed[0].map(h => h.trim().toLowerCase());
    const idx = {
      task: headers.indexOf('task'),
      status: headers.indexOf('status'),
      priority: headers.indexOf('priority'),
      category: headers.indexOf('category'),
      assignee: headers.indexOf('assigned to'),
      assignedBy: headers.indexOf('assigned by'),
      created: headers.indexOf('created'),
      due: headers.indexOf('due'),
      completed: headers.indexOf('completed'),
      subtasks: headers.indexOf('subtasks'),
      notes: headers.indexOf('notes'),
      waitingOn: headers.indexOf('waiting on'),
      repeat: headers.indexOf('repeat'),
      starred: headers.indexOf('starred')
    };

    // skip tasks already on the list (or archived), and repeats within the file: same name + created date
    const taskKey = (name, created) => name.trim().toLowerCase() + '|' + toISODate(created);
    const seen = new Set(todos.concat(archivedTasks).map(t => taskKey(t.text || '', t.createdAt)));
    let skippedCount = 0;

    if (idx.task === -1) {
      showImportStatus("That doesn't look like a file exported from this app.", 'error');
      return;
    }

    let importedCount = 0;
    let newCategoryAdded = false;
    let newAssigneeAdded = false;
    let newAssignedByAdded = false;

    for (let r = 1; r < parsed.length; r++) {
      const row = parsed[r];
      const text_ = (row[idx.task] || '').trim();
      if (!text_) continue;

      const hasStatusColumn = idx.status !== -1;
      const statusValue = hasStatusColumn ? (row[idx.status] || '').trim().toLowerCase() : '';
      const done = hasStatusColumn ? statusValue === 'completed' : true;
      const pending = hasStatusColumn ? statusValue === 'pending' : false;

      let priority = (idx.priority !== -1 ? row[idx.priority] : 'medium') || 'medium';
      priority = priority.trim().toLowerCase();
      if (!['high', 'medium', 'low'].includes(priority)) priority = 'medium';

      const category = idx.category !== -1 ? (row[idx.category] || '').trim() : '';
      const assigneesRaw = idx.assignee !== -1 ? (row[idx.assignee] || '').trim() : '';
      const importedAssignees = assigneesRaw
        ? assigneesRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean)
        : [];
      const assignedTo = importedAssignees[0] || '';
      const assignedBy = idx.assignedBy !== -1 ? (row[idx.assignedBy] || '').trim() : '';
      const dueDate = idx.due !== -1 && /^\d{4}-\d{2}-\d{2}$/.test((row[idx.due] || '').trim())
        ? row[idx.due].trim()
        : '';
      const createdAt = idx.created !== -1
        ? (parseISODateToTimestamp((row[idx.created] || '').trim()) || Date.now())
        : Date.now();
      const key = taskKey(text_, createdAt);
      if (seen.has(key)) { skippedCount++; continue; }
      seen.add(key);
      const completedAt = done && idx.completed !== -1
        ? parseISODateToTimestamp((row[idx.completed] || '').trim())
        : null;
      let subtasks = [];
      if (idx.subtasks !== -1 && row[idx.subtasks]) {
        subtasks = row[idx.subtasks]
          .split('|')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => {
            const dateMatch = s.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
            const subCreatedAt = dateMatch ? (parseISODateToTimestamp(dateMatch[1]) || createdAt) : createdAt;
            const withoutDate = dateMatch ? s.slice(0, dateMatch.index).trim() : s;
            const noteMatch = withoutDate.match(/^\(note\)\s*(.*)$/i);
            if (noteMatch) {
              return { id: uid(), text: noteMatch[1], done: false, type: 'note', createdAt: subCreatedAt };
            }
            const match = withoutDate.match(/^\[([ x])\]\s*(.*)$/i);
            if (match) {
              return { id: uid(), text: match[2], done: match[1].toLowerCase() === 'x', type: 'subtask', createdAt: subCreatedAt };
            }
            return { id: uid(), text: withoutDate, done: false, type: 'subtask', createdAt: subCreatedAt };
          });
      } else if (idx.notes !== -1 && row[idx.notes]) {
        const notesRaw = row[idx.notes].trim();
        if (notesRaw) subtasks = [{ id: uid(), text: notesRaw, done: false, type: 'subtask', createdAt }];
      }

      todos.push({
        id: uid(),
        text: text_,
        done,
        pending,
        createdAt,
        priority,
        dueDate,
        category,
        assignedTo,
        assignees: importedAssignees,
        assignedBy,
        subtasks,
        completedAt,
        waitingOn: idx.waitingOn !== -1 ? (row[idx.waitingOn] || '').trim() : '',
        repeat: idx.repeat !== -1 && ['daily', 'weekdays', 'weekly', 'monthly'].includes((row[idx.repeat] || '').trim()) && dueDate ? row[idx.repeat].trim() : '',
        starred: idx.starred !== -1 && /^(yes|true|1)$/i.test((row[idx.starred] || '').trim())
      });

      if (category && !categories.includes(category)) {
        categories.push(category);
        newCategoryAdded = true;
      }

      importedAssignees.forEach(person => {
        if (!assignees.includes(person)) {
          assignees.push(person);
          newAssigneeAdded = true;
        }
      });

      if (assignedBy && !assignedByOptions.includes(assignedBy)) {
        assignedByOptions.push(assignedBy);
        newAssignedByAdded = true;
      }

      importedCount++;
    }

    const skippedNote = skippedCount ? ' Skipped ' + skippedCount + ' already on your list (same name and created date).' : '';
    if (importedCount === 0) {
      showImportStatus(skippedCount ? 'Nothing new to import.' + skippedNote : 'No valid tasks found in that file.', skippedCount ? 'success' : 'error');
      return;
    }

    save();
    if (newCategoryAdded) {
      sortAlpha(categories);
      saveCategories();
      populateCategorySelect();
      renderCategoryList();
    }
    if (newAssigneeAdded) {
      sortAlpha(assignees);
      saveAssignees();
      populateAssigneeChecklist();
      renderAssigneeList();
    }
    if (newAssignedByAdded) {
      sortAlpha(assignedByOptions);
      saveAssignedByOptions();
      populateAssignedBySelect();
      renderAssignedByList();
    }
    render();
    showImportStatus('Imported ' + importedCount + (importedCount === 1 ? ' task.' : ' tasks.') + skippedNote, 'success');
  }

  function showImportStatus(message, type) {
    const el = document.getElementById('importStatus');
    el.textContent = message;
    el.className = 'import-status' + (type ? ' ' + type : '');
  }

  function downloadCsv(headers, rows, filename) {
    const csv = [headers, ...rows]
      .map(row => row.map(csvEscape).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function summarizeSubtasks(item) {
    if (item.subtasks && item.subtasks.length > 0) {
      return item.subtasks
        .map(s => {
          const isNote = s.type === 'note';
          const checkbox = isNote ? '(note)' : '[' + (s.done ? 'x' : ' ') + ']';
          return checkbox + ' ' + s.text + ' (' + toISODate(s.createdAt || item.createdAt) + ')';
        })
        .join(' | ');
    }
    return '';
  }

  function getAssigneesText(item) {
    const list = item.assignees || (item.assignedTo ? [item.assignedTo] : []);
    return list.join('; ');
  }

  function exportCompleted() {
    const completedItems = todos.filter(t => t.done);
    const headers = ['Task', 'Priority', 'Category', 'Assigned To', 'Assigned By', 'Created', 'Due', 'Completed', 'Subtasks'];
    const rows = completedItems.map(item => [
      item.text,
      item.priority || 'medium',
      item.category || '',
      getAssigneesText(item),
      item.assignedBy || '',
      toISODate(item.createdAt),
      toISODate(item.dueDate),
      toISODate(item.completedAt),
      summarizeSubtasks(item)
    ]);

    downloadCsv(headers, rows, 'completed-tasks-' + todayDateString() + '.csv');
    hasExportedThisSession = true;
    lastExportAt = Date.now();
    queuedStorageSet(LAST_EXPORT_KEY, String(lastExportAt));
    updateFooterStatus();
  }

  function exportAllTasks() {
    const headers = ['Task', 'Status', 'Priority', 'Category', 'Assigned To', 'Assigned By', 'Created', 'Due', 'Completed', 'Subtasks', 'Waiting On', 'Repeat', 'Starred'];
    const rows = todos.map(item => [
      item.text,
      item.done ? 'Completed' : (item.pending ? 'Pending' : 'Active'),
      item.priority || 'medium',
      item.category || '',
      getAssigneesText(item),
      item.assignedBy || '',
      toISODate(item.createdAt),
      toISODate(item.dueDate),
      toISODate(item.completedAt),
      summarizeSubtasks(item),
      item.waitingOn || '',
      item.repeat || '',
      item.starred ? 'yes' : ''
    ]);

    downloadCsv(headers, rows, 'all-tasks-' + todayDateString() + '.csv');
    hasExportedThisSession = true;
    lastExportAt = Date.now();
    queuedStorageSet(LAST_EXPORT_KEY, String(lastExportAt));
    updateFooterStatus();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function generateReport() {
    const includeCompleted = document.getElementById('reportIncludeCompleted').checked;
    const active = todos.filter(t => !t.done && !t.pending);
    const pendingTasks = todos.filter(t => !t.done && t.pending);
    const completed = todos.filter(t => t.done);
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    const priorityCounts = { high: 0, medium: 0, low: 0 };
    active.forEach(t => { priorityCounts[t.priority || 'medium']++; });

    const categoryCounts = {};
    active.forEach(t => {
      const cat = t.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    let totalSubtasks = 0;
    let doneSubtasks = 0;
    todos.forEach(t => {
      (t.subtasks || []).forEach(s => {
        totalSubtasks++;
        if (s.done) doneSubtasks++;
      });
    });

    const openPool = todos.filter(t => !t.done);
    const todayStrRpt = todayDateString();
    const todayTimeRpt = new Date(todayStrRpt + 'T00:00:00').getTime();
    const weekEndTimeRpt = todayTimeRpt + 7 * 24 * 60 * 60 * 1000;
    const nextWeekTasks = openPool
      .filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        return d.getTime() >= todayTimeRpt && d.getTime() <= weekEndTimeRpt;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const urgentTasks = openPool
      .filter(t => isPastDue(t.dueDate) || (t.priority || 'medium') === 'high')
      .sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);

    function renderTaskBlock(t) {
      const subs = t.subtasks || [];
      const subsDone = subs.filter(s => s.done).length;
      const subtaskHtml = subs.length > 0
        ? '<ul class="rpt-subtasks">' + subs.map(s =>
            '<li class="' + (s.done ? 'rpt-sub-done' : '') + '">' +
            (s.done ? '\u2611' : '\u2610') + ' ' + escapeHtml(s.text) +
            '</li>'
          ).join('') + '</ul>'
        : '';

      return '<div class="rpt-task">' +
        '<div class="rpt-task-row">' +
          '<span class="rpt-task-name">' + escapeHtml(t.text) + '</span>' +
          '<span class="rpt-tag rpt-priority-' + (t.priority || 'medium') + '">' + (t.priority || 'medium') + '</span>' +
        '</div>' +
        '<div class="rpt-task-meta">' +
          (t.category ? '<span>Category: ' + escapeHtml(t.category) + '</span>' : '') +
          (getAssigneesText(t) ? '<span>Assigned: ' + escapeHtml(getAssigneesText(t).replace(/;/g, ',')) + '</span>' : '') +
          (t.assignedBy ? '<span>From: ' + escapeHtml(t.assignedBy) + '</span>' : '') +
          (t.dueDate ? '<span>Due: ' + escapeHtml(toISODate(t.dueDate)) + '</span>' : '') +
          (t.done && t.completedAt ? '<span>Completed: ' + escapeHtml(toISODate(t.completedAt)) + '</span>' : '') +
          (subs.length > 0 ? '<span>Subtasks: ' + subsDone + '/' + subs.length + '</span>' : '') +
        '</div>' +
        subtaskHtml +
        '</div>';
    }

    const activeSorted = active.slice().sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
    const pendingSorted = pendingTasks.slice().sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
    const completedSorted = completed.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    const now = new Date();
    const genDD = String(now.getDate()).padStart(2, '0');
    const genMM = String(now.getMonth() + 1).padStart(2, '0');
    const genYYYY = now.getFullYear();
    const genTime = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const generatedStr = genDD + '/' + genMM + '/' + genYYYY + ' ' + genTime;

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Summary Report</title><style>' +
      'body{font-family:Georgia,serif;color:#222;max-width:800px;margin:40px auto;padding:0 20px;}' +
      'h1{font-size:22px;margin-bottom:4px;}' +
      '.rpt-generated{color:#777;font-size:12px;margin-bottom:24px;}' +
      '.rpt-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 20px;padding:16px 0;border-top:2px solid #222;border-bottom:2px solid #222;margin-bottom:24px;}' +
      '.rpt-stat{font-size:12px;text-align:center;}' +
      '.rpt-stat b{display:block;font-size:19px;}' +
      'h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:6px;margin-top:32px;}' +
      '.rpt-task{padding:12px 0;border-bottom:2px solid #999;}' +
      '.rpt-task-row{display:flex;justify-content:space-between;align-items:center;}' +
      '.rpt-task-name{font-weight:bold;font-size:14px;}' +
      '.rpt-tag{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;padding:2px 7px;border-radius:3px;border:1px solid #999;}' +
      '.rpt-priority-high{color:#b33a3a;border-color:#b33a3a;}' +
      '.rpt-priority-medium{color:#96631e;border-color:#96631e;}' +
      '.rpt-priority-low{color:#3f6b4f;border-color:#3f6b4f;}' +
      '.rpt-task-meta{font-size:11px;color:#666;margin-top:4px;display:flex;gap:14px;flex-wrap:wrap;}' +
      '.rpt-task-meta span{margin-right:14px;}' +
      '.rpt-task-meta span:last-child{margin-right:0;}' +
      '.rpt-subtasks{margin:6px 0 0;padding-left:20px;font-size:12px;}' +
      '.rpt-subtasks li{margin-bottom:2px;}' +
      '.rpt-sub-done{color:#888;text-decoration:line-through;}' +
      '.rpt-empty{color:#999;font-style:italic;font-size:13px;}' +
      '.rpt-highlights{display:flex;flex-wrap:wrap;gap:24px;background:#f7f7f7;border:2px solid #000;border-radius:6px;padding:16px 18px;margin-bottom:28px;}' +
      '.rpt-highlights h2{width:100%;margin:0 0 12px;border:none;padding:0;font-size:15px;}' +
      '.rpt-highlight-col{flex:1 1 240px;min-width:0;}' +
      '.rpt-highlight-col h3{font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#555;margin:0 0 8px;}' +
      '.rpt-highlight-list{list-style:none;margin:0;padding:0;}' +
      '.rpt-highlight-list li{padding:9px 0;border-bottom:1px solid #e5e5e5;}' +
      '.rpt-highlight-task{font-size:14px;line-height:1.5;color:#222;}' +
      '.rpt-highlight-meta{margin-top:3px;font-size:11px;letter-spacing:0.3px;color:#777;}' +
      '.rpt-highlight-date{font-weight:bold;color:#555;}' +
      '.rpt-highlight-no-date{font-style:italic;color:#999;}' +
      '.rpt-highlight-flag{display:inline-block;margin-top:5px;margin-right:5px;font-size:9px;font-weight:bold;letter-spacing:0.5px;padding:2px 6px;border-radius:3px;color:#fff;}' +
      '.rpt-flag-overdue{background:#b33a3a;}' +
      '.rpt-flag-high{background:#96631e;}' +
      '.rpt-print-btn{position:fixed;top:20px;right:20px;background:#222;color:#fff;border:none;padding:8px 16px;font-size:12px;letter-spacing:0.5px;cursor:pointer;border-radius:3px;}' +
      '@media print{.rpt-print-btn{display:none;}}' +
      '</style></head><body>' +
      '<button class="rpt-print-btn" onclick="window.print()">Print / Save as PDF</button>' +
      '<h1>Summary Report</h1>' +
      '<div class="rpt-generated">Generated ' + escapeHtml(generatedStr) + '</div>' +
      '<div class="rpt-stats">' +
        '<div class="rpt-stat"><b>' + todos.length + '</b>Total tasks</div>' +
        '<div class="rpt-stat"><b>' + active.length + '</b>Active</div>' +
        '<div class="rpt-stat"><b>' + pendingTasks.length + '</b>Pending</div>' +
        '<div class="rpt-stat"><b>' + completed.length + '</b>Completed</div>' +
        '<div class="rpt-stat"><b>' + priorityCounts.high + '</b>High priority</div>' +
        '<div class="rpt-stat"><b>' + priorityCounts.medium + '</b>Medium priority</div>' +
        '<div class="rpt-stat"><b>' + priorityCounts.low + '</b>Low priority</div>' +
        '<div class="rpt-stat"><b>' + doneSubtasks + '/' + totalSubtasks + '</b>Subtasks done</div>' +
      '</div>' +
      '<div class="rpt-highlights">' +
        '<h2>Highlights</h2>' +
        '<div class="rpt-highlight-col">' +
          '<h3>Due in the Next 7 Days (' + nextWeekTasks.length + ')</h3>' +
          (nextWeekTasks.length > 0
            ? '<ul class="rpt-highlight-list">' + nextWeekTasks.map(t =>
                '<li>' +
                  '<div class="rpt-highlight-task">' + escapeHtml(t.text) + '</div>' +
                  '<div class="rpt-highlight-meta">Due <span class="rpt-highlight-date">' + escapeHtml(toUKDateShort(t.dueDate)) + '</span></div>' +
                '</li>'
              ).join('') + '</ul>'
            : '<div class="rpt-empty">Nothing due in the next 7 days.</div>') +
        '</div>' +
        '<div class="rpt-highlight-col">' +
          '<h3>Overdue or High Priority (' + urgentTasks.length + ')</h3>' +
          (urgentTasks.length > 0
            ? '<ul class="rpt-highlight-list">' + urgentTasks.map(t =>
                '<li>' +
                  '<div class="rpt-highlight-task">' + escapeHtml(t.text) + '</div>' +
                  '<div class="rpt-highlight-meta">' +
                    (isPastDue(t.dueDate) ? '<span class="rpt-highlight-flag rpt-flag-overdue">OVERDUE</span>' : '') +
                    ((t.priority || 'medium') === 'high' ? '<span class="rpt-highlight-flag rpt-flag-high">HIGH</span>' : '') +
                    (t.dueDate ? ' Due <span class="rpt-highlight-date">' + escapeHtml(toUKDateShort(t.dueDate)) + '</span>' : ' <span class="rpt-highlight-no-date">No due date</span>') +
                  '</div>' +
                '</li>'
              ).join('') + '</ul>'
            : '<div class="rpt-empty">Nothing overdue or high priority.</div>') +
        '</div>' +
      '</div>' +
      '<h2>Active Tasks (' + active.length + ')</h2>' +
      (activeSorted.length > 0 ? activeSorted.map(renderTaskBlock).join('') : '<div class="rpt-empty">No active tasks.</div>') +
      '<h2>Pending Tasks (' + pendingTasks.length + ')</h2>' +
      (pendingSorted.length > 0 ? pendingSorted.map(renderTaskBlock).join('') : '<div class="rpt-empty">No pending tasks.</div>') +
      (includeCompleted
        ? '<h2>Completed Tasks (' + completed.length + ')</h2>' +
          (completedSorted.length > 0 ? completedSorted.map(renderTaskBlock).join('') : '<div class="rpt-empty">No completed tasks.</div>')
        : '') +
      '</body></html>';

    document.getElementById('reportFrame').srcdoc = html;
    document.getElementById('reportOverlay').classList.add('open');
    document.getElementById('reportClose').focus();
  }

  document.getElementById('reportClose').addEventListener('click', () => {
    document.getElementById('reportOverlay').classList.remove('open');
  });
  document.getElementById('reportPrint').addEventListener('click', () => {
    const f = document.getElementById('reportFrame');
    f.contentWindow.focus();
    f.contentWindow.print();
  });

  exportBtn.addEventListener('click', exportCompleted);
  exportAllBtn.addEventListener('click', exportAllTasks);
  reportBtn.addEventListener('click', generateReport);

  reminderEmailInput.addEventListener('change', () => {
    queuedStorageSet(REMINDER_EMAIL_KEY, reminderEmailInput.value.trim());
  });

  function emailPriorityTasks() {
    const to = reminderEmailInput.value.trim();
    const todayStr = todayDateString();

    const overdue = todos.filter(t => !t.done && isPastDue(t.dueDate));
    const dueToday = todos.filter(t => !t.done && t.dueDate === todayStr);
    const highPriority = todos.filter(t =>
      !t.done &&
      (t.priority || 'medium') === 'high' &&
      !isPastDue(t.dueDate) &&
      t.dueDate !== todayStr
    );

    if (overdue.length === 0 && dueToday.length === 0 && highPriority.length === 0) {
      showToast('Nothing overdue, due today, or high priority right now.');
      return;
    }

    const totalCount = overdue.length + dueToday.length + highPriority.length;
    const subject = 'Priority Tasks (' + totalCount + ') - ' + toUKDateShort(todayStr);

    const lines = [];
    if (overdue.length > 0) {
      lines.push('OVERDUE (' + overdue.length + ')');
      overdue.forEach(t => {
        lines.push('- ' + t.text + (t.dueDate ? ' (was due ' + toUKDateShort(t.dueDate) + ')' : ''));
      });
      lines.push('');
    }
    if (dueToday.length > 0) {
      lines.push('DUE TODAY (' + dueToday.length + ')');
      dueToday.forEach(t => lines.push('- ' + t.text));
      lines.push('');
    }
    if (highPriority.length > 0) {
      lines.push('HIGH PRIORITY (' + highPriority.length + ')');
      highPriority.forEach(t => {
        lines.push('- ' + t.text + (t.dueDate ? ' (due ' + toUKDateShort(t.dueDate) + ')' : ''));
      });
    }

    const includeReport = document.getElementById('emailReportOptionPdf').checked;
    if (includeReport) {
      lines.push('');
      lines.push('(A copy of the Summary Report has been opened in another tab \u2014 use "Print / Save as PDF" there, then attach it to this email before sending.)');
    }

    const body = lines.join('\n');
    const mailto = 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    if (includeReport) {
      generateReport();
    }

    window.location.href = mailto;
  }

  emailPriorityBtn.addEventListener('click', emailPriorityTasks);

  document.getElementById('importBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      showImportStatus('Choose a CSV file first.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => importTasksFromCsv(reader.result);
    reader.onerror = () => showImportStatus('Could not read that file.', 'error');
    reader.readAsText(file);
  });


  // ---------- drag to reorder (within a group) ----------
  let dragId = null;
  function clearDropMarks() {
    listEl.querySelectorAll('.drop-before, .drop-after, .dragging').forEach(el => el.classList.remove('drop-before', 'drop-after', 'dragging'));
  }
  listEl.addEventListener('dragstart', e => {
    const li = e.target.closest && e.target.closest('li.item');
    if (!li || !li.dataset.id) return;
    dragId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* ignore */ }
  });
  listEl.addEventListener('dragover', e => {
    const li = e.target.closest && e.target.closest('li.item');
    if (!dragId || !li || li.dataset.id === dragId) return;
    const dragged = listEl.querySelector('li.item[data-id="' + dragId + '"]');
    if (!dragged || dragged.dataset.group !== li.dataset.group) return;
    e.preventDefault();
    const after = e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2;
    listEl.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
    li.classList.add(after ? 'drop-after' : 'drop-before');
  });
  listEl.addEventListener('drop', e => {
    const li = e.target.closest && e.target.closest('li.item');
    if (!dragId || !li) return;
    e.preventDefault();
    const after = li.classList.contains('drop-after');
    const from = todos.findIndex(t => t.id === dragId);
    const moved = from >= 0 ? todos.splice(from, 1)[0] : null;
    let to = todos.findIndex(t => t.id === li.dataset.id);
    if (moved && to >= 0) {
      todos.splice(after ? to + 1 : to, 0, moved);
      if (sortBy === 'name') showToast('Reordering has no effect when sorted by name.');
    } else if (moved) {
      todos.splice(from, 0, moved);
    }
    dragId = null;
    clearDropMarks();
    render();
    save();
  });
  listEl.addEventListener('dragend', () => { dragId = null; clearDropMarks(); });

  // ---------- keyboard shortcuts and focus return ----------
  const overlayClosers = [
    ['newTaskOverlay', 'newTaskWindowClose'],
    ['settingsOverlay', 'closeSettingsBtn'],
    ['dueSummaryOverlay', 'closeDueSummaryBtn'],
    ['reportOverlay', 'reportClose'],
    ['taskEditOverlay', 'taskEditClose']
  ];
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      for (const pair of overlayClosers) {
        const ov = document.getElementById(pair[0]);
        if (ov && ov.classList.contains('open')) { document.getElementById(pair[1]).click(); return; }
      }
      if (selectMode) { exitSelectMode(); return; }
      if (document.activeElement && document.activeElement.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) document.activeElement.blur();
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.isContentEditable);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-overlay.open, .new-task-overlay.open')) return;
    if (e.key === 'n') {
      e.preventDefault();
      if (page !== 'active' && page !== 'today') setPage('active');
      newTaskBtn.click();
    }
    else if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
  });

  // a click anywhere in a date box opens the calendar, not just a click on its small icon
  document.addEventListener('click', e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'date' || el.disabled || typeof el.showPicker !== 'function') return;
    try { el.showPicker(); } catch (err) { /* already open, or not allowed here: the browser's own behaviour applies */ }
  });

  let lastOutsideFocus = null;
  document.addEventListener('focusin', e => {
    if (!e.target.closest || !e.target.closest('.modal-overlay, .new-task-overlay')) lastOutsideFocus = e.target;
  });
  // while any pop-up is open the page behind it is locked, so scrolling moves the pop-up, not the page
  function syncScrollLock() {
    document.documentElement.classList.toggle('overlay-open', !!document.querySelector('.modal-overlay.open, .new-task-overlay.open'));
  }
  document.querySelectorAll('.modal-overlay, .new-task-overlay').forEach(ov => {
    let wasOpen = false;
    new MutationObserver(() => {
      const isOpen = ov.classList.contains('open');
      if (wasOpen && !isOpen && lastOutsideFocus && document.contains(lastOutsideFocus)) lastOutsideFocus.focus();
      wasOpen = isOpen;
      syncScrollLock();
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  });
  syncScrollLock();

  addBtn.addEventListener('click', addItem);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') addItem();
  });

  newTaskBtn.addEventListener('click', () => {
    addFormOpen = true;
    render();
    input.focus();
  });

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    render();
  });

  function toggleFilter(mode) {
    filterMode = (filterMode === mode) ? null : mode;
    setPage('active');
  }

  document.getElementById('dueTodayStat').addEventListener('click', () => toggleFilter('dueToday'));
  document.getElementById('overdueStat').addEventListener('click', () => toggleFilter('overdue'));
  document.getElementById('dueTodayTopTrigger').addEventListener('click', () => toggleFilter('dueToday'));
  document.getElementById('overdueTopTrigger').addEventListener('click', () => toggleFilter('overdue'));
  document.getElementById('pendingStat').addEventListener('click', () => setPage('pending'));
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    filterMode = null;
    render();
  });

  function closeNewTaskWindow() {
    input.value = '';
    prioritySelect.value = 'medium';
    dueDateInput.value = '';
    categorySelect.value = '';
    repeatSelect.value = '';
    selectedAddAssignees = [];
    populateAssigneeChecklist();
    assignedBySelect.value = '';
    addFormOpen = false;
    render();
  }

  cancelAddBtn.addEventListener('click', closeNewTaskWindow);
  document.getElementById('newTaskWindowClose').addEventListener('click', closeNewTaskWindow);
  newTaskOverlay.addEventListener('click', e => {
    if (e.target === newTaskOverlay) closeNewTaskWindow();
  });

  tabActive.addEventListener('click', () => {
    // Clicking the main "To-do" tab always means "show me everything" -
    // clear any leftover Due Today/Overdue filter, even if we're already
    // technically on the active page (e.g. arrived here via a filter).
    filterMode = null;
    setPage('active');
  });
  tabToday.addEventListener('click', () => setPage('today'));
  tabPending.addEventListener('click', () => setPage('pending'));
  tabDone.addEventListener('click', () => setPage('done'));
  document.getElementById('staleTrigger').addEventListener('click', () => toggleFilter('stale'));

  function populateCategorySelect() {
    const previousValue = categorySelect.value;
    categorySelect.innerHTML = '';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'No category';
    categorySelect.appendChild(noneOpt);

    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });

    if (categories.includes(previousValue)) {
      categorySelect.value = previousValue;
    } else {
      categorySelect.value = '';
    }
  }

  function renderCategoryList() {
    categoryList.innerHTML = '';

    if (categories.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'category-empty';
      empty.textContent = 'No categories yet. Add one below.';
      categoryList.appendChild(empty);
      return;
    }

    categories.forEach((cat, index) => {
      const li = document.createElement('li');

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = cat;
      nameInput.maxLength = 30;
      nameInput.addEventListener('change', () => {
        renameCategory(index, nameInput.value.trim());
      });

      const del = document.createElement('button');
      del.className = 'delete-category';
      del.textContent = 'Remove';
      del.addEventListener('click', () => removeCategory(index));

      li.appendChild(nameInput);
      li.appendChild(del);
      categoryList.appendChild(li);
    });
  }

  function renameCategory(index, newName) {
    if (!newName) {
      renderCategoryList();
      return;
    }
    const oldName = categories[index];
    if (newName === oldName) return;
    categories[index] = newName;
    todos.forEach(t => {
      if (t.category === oldName) t.category = newName;
    });
    sortAlpha(categories);
    saveCategories();
    save();
    populateCategorySelect();
    renderCategoryList();
    render();
  }

  function removeCategory(index) {
    const oldName = categories[index];
    categories.splice(index, 1);
    todos.forEach(t => {
      if (t.category === oldName) t.category = '';
    });
    saveCategories();
    save();
    populateCategorySelect();
    renderCategoryList();
    render();
  }

  function addCategory() {
    const name = newCategoryInput.value.trim();
    if (!name) return;
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      newCategoryInput.value = '';
      return;
    }
    categories.push(name);
    sortAlpha(categories);
    newCategoryInput.value = '';
    saveCategories();
    populateCategorySelect();
    renderCategoryList();
  }

  function populateAssigneeChecklist() {
    assigneeChecklist.innerHTML = '';

    if (assignees.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'assignee-checklist-empty';
      emptyMsg.textContent = 'No one added yet (Settings \u2192 Assigned To).';
      assigneeChecklist.appendChild(emptyMsg);
      return;
    }

    assignees.forEach(person => {
      const label = document.createElement('label');
      label.className = 'assignee-checkbox-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedAddAssignees.includes(person);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!selectedAddAssignees.includes(person)) selectedAddAssignees.push(person);
        } else {
          selectedAddAssignees = selectedAddAssignees.filter(p => p !== person);
        }
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = person;

      label.appendChild(checkbox);
      label.appendChild(nameSpan);
      assigneeChecklist.appendChild(label);
    });
  }

  function renderAssigneeList() {
    assigneeList.innerHTML = '';

    if (assignees.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'category-empty';
      empty.textContent = 'No one added yet. Add a name below.';
      assigneeList.appendChild(empty);
      return;
    }

    assignees.forEach((person, index) => {
      const li = document.createElement('li');

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = person;
      nameInput.maxLength = 30;
      nameInput.addEventListener('change', () => {
        renameAssignee(index, nameInput.value.trim());
      });

      const del = document.createElement('button');
      del.className = 'delete-category';
      del.textContent = 'Remove';
      del.addEventListener('click', () => removeAssignee(index));

      li.appendChild(nameInput);
      li.appendChild(del);
      assigneeList.appendChild(li);
    });
  }

  function renameAssignee(index, newName) {
    if (!newName) {
      renderAssigneeList();
      return;
    }
    const oldName = assignees[index];
    if (newName === oldName) return;
    assignees[index] = newName;
    todos.forEach(t => {
      if (t.assignees) {
        t.assignees = t.assignees.map(p => p === oldName ? newName : p);
      }
      if (t.assignedTo === oldName) t.assignedTo = newName;
    });
    sortAlpha(assignees);
    saveAssignees();
    save();
    populateAssigneeChecklist();
    renderAssigneeList();
    render();
  }

  function removeAssignee(index) {
    const oldName = assignees[index];
    assignees.splice(index, 1);
    todos.forEach(t => {
      if (t.assignees) {
        t.assignees = t.assignees.filter(p => p !== oldName);
      }
      if (t.assignedTo === oldName) t.assignedTo = '';
    });
    saveAssignees();
    save();
    populateAssigneeChecklist();
    renderAssigneeList();
    render();
  }

  function addAssignee() {
    const name = newAssigneeInput.value.trim();
    if (!name) return;
    if (assignees.some(p => p.toLowerCase() === name.toLowerCase())) {
      newAssigneeInput.value = '';
      return;
    }
    assignees.push(name);
    sortAlpha(assignees);
    newAssigneeInput.value = '';
    saveAssignees();
    populateAssigneeChecklist();
    renderAssigneeList();
  }

  function populateAssignedBySelect() {
    const previousValue = assignedBySelect.value;
    assignedBySelect.innerHTML = '';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'Unassigned';
    assignedBySelect.appendChild(noneOpt);

    assignedByOptions.forEach(person => {
      const opt = document.createElement('option');
      opt.value = person;
      opt.textContent = person;
      assignedBySelect.appendChild(opt);
    });

    if (assignedByOptions.includes(previousValue)) {
      assignedBySelect.value = previousValue;
    } else {
      assignedBySelect.value = '';
    }
  }

  function renderAssignedByList() {
    assignedByListEl.innerHTML = '';

    if (assignedByOptions.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'category-empty';
      empty.textContent = 'No one added yet. Add a name below.';
      assignedByListEl.appendChild(empty);
      return;
    }

    assignedByOptions.forEach((person, index) => {
      const li = document.createElement('li');

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = person;
      nameInput.maxLength = 30;
      nameInput.addEventListener('change', () => {
        renameAssignedBy(index, nameInput.value.trim());
      });

      const del = document.createElement('button');
      del.className = 'delete-category';
      del.textContent = 'Remove';
      del.addEventListener('click', () => removeAssignedBy(index));

      li.appendChild(nameInput);
      li.appendChild(del);
      assignedByListEl.appendChild(li);
    });
  }

  function renameAssignedBy(index, newName) {
    if (!newName) {
      renderAssignedByList();
      return;
    }
    const oldName = assignedByOptions[index];
    if (newName === oldName) return;
    assignedByOptions[index] = newName;
    todos.forEach(t => {
      if (t.assignedBy === oldName) t.assignedBy = newName;
    });
    sortAlpha(assignedByOptions);
    saveAssignedByOptions();
    save();
    populateAssignedBySelect();
    renderAssignedByList();
    render();
  }

  function removeAssignedBy(index) {
    const oldName = assignedByOptions[index];
    assignedByOptions.splice(index, 1);
    todos.forEach(t => {
      if (t.assignedBy === oldName) t.assignedBy = '';
    });
    saveAssignedByOptions();
    save();
    populateAssignedBySelect();
    renderAssignedByList();
    render();
  }

  function addAssignedBy() {
    const name = newAssignedByInput.value.trim();
    if (!name) return;
    if (assignedByOptions.some(p => p.toLowerCase() === name.toLowerCase())) {
      newAssignedByInput.value = '';
      return;
    }
    assignedByOptions.push(name);
    sortAlpha(assignedByOptions);
    newAssignedByInput.value = '';
    saveAssignedByOptions();
    populateAssignedBySelect();
    renderAssignedByList();
  }

  function openSettings() {
    renderCategoryList();
    renderAssigneeList();
    renderAssignedByList();
    updateEncryptionUI();
    settingsOverlay.classList.add('open');
  }

  function closeSettings() {
    settingsOverlay.classList.remove('open');
  }

  settingsBtn.addEventListener('click', openSettings);

  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.accordion-section');
      section.classList.toggle('open');
    });
  });
  closeSettingsBtn.addEventListener('click', closeSettings);
  document.getElementById('closeSettingsBottomBtn').addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', e => {
    if (e.target === settingsOverlay) closeSettings();
  });
  addCategoryBtn.addEventListener('click', addCategory);
  newCategoryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addCategory();
  });
  addAssigneeBtn.addEventListener('click', addAssignee);
  newAssigneeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addAssignee();
  });
  addAssignedByBtn.addEventListener('click', addAssignedBy);
  newAssignedByInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addAssignedBy();
  });

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function updateSecurityUI() {
    if (passwordHash) {
      passwordStatus.textContent = 'Password protection is ON';
      passwordStatus.className = 'password-status enabled';
      newPasswordInput.placeholder = 'New password (replaces current)';
      setPasswordBtn.textContent = 'Update Password';
      removePasswordBtn.style.display = 'block';
      lockBtn.style.display = 'flex';
    } else {
      passwordStatus.textContent = 'No password set';
      passwordStatus.className = 'password-status';
      newPasswordInput.placeholder = 'New password';
      setPasswordBtn.textContent = 'Set Password';
      removePasswordBtn.style.display = 'none';
      lockBtn.style.display = 'none';
    }
  }

  async function setPassword() {
    const value = newPasswordInput.value;
    if (!value) return;
    passwordHash = await sha256(value);
    newPasswordInput.value = '';
    await queuedStorageSet(PASSWORD_HASH_KEY, passwordHash);
    updateSecurityUI();
  }

  async function removePassword() {
    passwordHash = '';
    await queuedStorageSet(PASSWORD_HASH_KEY, '');
    updateSecurityUI();
  }

  function showLock() {
    setLockMode(false);
    unlockInput.value = '';
    unlockError.textContent = '';
    lockOverlay.classList.add('open');
    closeSettings();
  }

  function hideLock() {
    lockOverlay.classList.remove('open');
  }

  // ---------- data encryption (the work is done in gh-storage.js; this is the UI) ----------
  const ENC = window.TodoGH && window.TodoGH.encryption;
  const lockTitleEl = document.getElementById('lockTitle');
  const lockHintEl = document.getElementById('lockHint');
  let encUnlocking = false;   // the lock screen is asking for the passphrase, not the password

  function encryptionOn() {
    return !!ENC && ENC.state() === 'on';
  }

  function setLockMode(isEncryption, reason) {
    lockTitleEl.textContent = isEncryption ? 'Encrypted' : 'Locked';
    lockHintEl.textContent = !isEncryption
      ? 'Enter your password to view your to-do list.'
      : reason === 'changed'
        ? 'The passphrase for this list was changed on another device. Enter the new passphrase to keep syncing.'
        : 'Enter your passphrase to decrypt and open your to-do list.';
    unlockInput.placeholder = isEncryption ? 'Passphrase' : 'Password';
  }

  function promptForPassphrase() {
    if (encUnlocking) return;
    encUnlocking = true;
    setLockMode(true, ENC.lockReason());
    unlockInput.value = '';
    unlockError.textContent = ENC.available ? '' : 'Encryption is not available in this browser, so this list cannot be opened here.';
    lockOverlay.classList.add('open');
    closeSettings();
    setTimeout(() => unlockInput.focus(), 50);
  }

  async function attemptEncUnlock() {
    const pass = unlockInput.value;
    if (!pass || !ENC.available) return;
    unlockBtn.disabled = true;
    unlockError.textContent = 'Unlocking…';
    try {
      if (await ENC.unlock(pass)) {
        encUnlocking = false;
        unlockInput.value = '';
        unlockError.textContent = '';
        hideLock();
        setLockMode(false);
        updateEncryptionUI();
      } else {
        unlockError.textContent = 'Incorrect passphrase. Try again.';
        unlockInput.value = '';
        unlockInput.focus();
      }
    } finally {
      unlockBtn.disabled = false;
    }
  }

  if (ENC) {
    window.addEventListener('todo-enc-locked', promptForPassphrase);
    if (ENC.state() === 'locked') promptForPassphrase();
  }

  const encStatus = document.getElementById('encStatus');
  const encPassInput = document.getElementById('encPassInput');
  const encPassConfirm = document.getElementById('encPassConfirm');
  const encSetBtn = document.getElementById('encSetBtn');
  const encOffBtn = document.getElementById('encOffBtn');
  const encMsg = document.getElementById('encMsg');

  function showEncMsg(text, type) {
    encMsg.textContent = text;
    encMsg.className = 'import-status' + (type ? ' ' + type : '');
  }

  function updateEncryptionUI() {
    if (!ENC || !ENC.available) {
      encStatus.textContent = 'Encryption is not available in this browser';
      encStatus.className = 'password-status';
      encSetBtn.disabled = true;
      encPassInput.disabled = true;
      encPassConfirm.disabled = true;
      return;
    }
    if (encryptionOn()) {
      encStatus.textContent = 'Data encryption is ON';
      encStatus.className = 'password-status enabled';
      encPassInput.placeholder = 'New passphrase (replaces current)';
      encSetBtn.textContent = 'Change Passphrase';
      encOffBtn.style.display = 'block';
    } else {
      encStatus.textContent = 'Data encryption is OFF';
      encStatus.className = 'password-status';
      encPassInput.placeholder = 'New passphrase (at least 8 characters)';
      encSetBtn.textContent = 'Turn On Encryption';
      encOffBtn.style.display = 'none';
    }
  }

  async function turnOnOrChangeEncryption() {
    if (!ENC || !ENC.available) return;
    const pass = encPassInput.value;
    if (pass.length < 8) {
      showEncMsg('The passphrase must be at least 8 characters. A few random words works well.', 'error');
      return;
    }
    if (pass !== encPassConfirm.value) {
      showEncMsg('The two passphrases do not match.', 'error');
      return;
    }
    if (ENC.state() === 'locked') {
      showEncMsg('Unlock the list with its current passphrase first.', 'error');
      return;
    }
    const changing = encryptionOn();
    const ok = await askConfirm(
      (changing ? 'Your list will be re-encrypted with the new passphrase.' : 'Your list will be encrypted with this passphrase, on this device and on GitHub.') +
      ' Every device will need it to open the list. If you forget it, your list CANNOT be recovered, not by you and not by anyone else. Make sure you have a CSV export saved as a backup.',
      changing ? 'Change passphrase' : 'Encrypt'
    );
    if (!ok) return;
    encSetBtn.disabled = true;
    showEncMsg('Encrypting… this takes a second or two.', '');
    try {
      await ENC.enable(pass);
      encPassInput.value = '';
      encPassConfirm.value = '';
      updateEncryptionUI();
      const onGitHub = !!TodoGH.cfg().token;
      showEncMsg((changing ? 'Passphrase changed.' : 'Encryption is on.') + ' Your list is stored encrypted on this device' +
        (onGitHub ? ' and is saved encrypted to GitHub. Other devices will ask for the passphrase when they next sync.' : '.'), 'success');
    } catch (e) {
      console.error('Turning on encryption failed', e);
      showEncMsg('Something went wrong turning on encryption. Please reload and try again.', 'error');
    } finally {
      encSetBtn.disabled = false;
    }
  }

  async function turnOffEncryption() {
    const ok = await askConfirm('Turn off encryption? Your list will be stored as readable (unencrypted) text again, on this device and on GitHub.', 'Turn off');
    if (!ok) return;
    encOffBtn.disabled = true;
    try {
      await ENC.disable();
      updateEncryptionUI();
      showEncMsg('Encryption is off. Your list is stored unencrypted again.', 'success');
    } catch (e) {
      console.error('Turning off encryption failed', e);
      showEncMsg('Something went wrong turning off encryption. Please reload and check your list.', 'error');
    } finally {
      encOffBtn.disabled = false;
    }
  }

  encSetBtn.addEventListener('click', turnOnOrChangeEncryption);
  encOffBtn.addEventListener('click', turnOffEncryption);

  async function attemptUnlock() {
    if (encUnlocking) {
      await attemptEncUnlock();
      return;
    }
    const attempt = await sha256(unlockInput.value);
    if (attempt === passwordHash) {
      hideLock();
      maybeShowDueSummary();
    } else {
      unlockError.textContent = 'Incorrect password. Try again.';
      unlockInput.value = '';
      unlockInput.focus();
    }
  }

  setPasswordBtn.addEventListener('click', setPassword);
  removePasswordBtn.addEventListener('click', removePassword);

  document.getElementById('clearAllTasksBtn').addEventListener('click', async () => {
    const count = todos.length;
    if (count === 0) {
      showToast('There are no tasks to clear.');
      return;
    }
    const confirmed = await askConfirm(
      'Delete all ' + count + ' task' + (count === 1 ? '' : 's') +
      ' (active and completed) in this list? Categories and settings are kept. You can undo this straight afterwards.',
      'Delete all'
    );
    if (!confirmed) return;
    snapshotUndo('Deleted ' + count + ' task' + (count === 1 ? '' : 's') + '.');
    todos = [];
    expandedIds.clear();
    confirmingTaskDelete.clear();
    confirmingSubtaskDelete.clear();
    filterMode = null;
    save();
    render();
  });
  lockBtn.addEventListener('click', showLock);
  unlockBtn.addEventListener('click', attemptUnlock);
  unlockInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptUnlock();
  });

  function closeDueSummary() {
    document.getElementById('dueSummaryOverlay').classList.remove('open');
  }

  document.getElementById('closeDueSummaryBtn').addEventListener('click', closeDueSummary);
  document.getElementById('dueSummaryOkBtn').addEventListener('click', closeDueSummary);
  document.getElementById('dueSummaryOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('dueSummaryOverlay')) closeDueSummary();
  });

  setInterval(() => {
    if (checkPendingDueDates()) {
      save();
      render();
    }
  }, 60000);

  load();
