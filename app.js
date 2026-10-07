  const listEl = document.getElementById('list');
  const emptyMsg = document.getElementById('emptyMsg');
  const listHeader = document.getElementById('listHeader');
  const lhCompleted = document.getElementById('lhCompleted');
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
  const tabActive = document.getElementById('tabActive');
  const tabPending = document.getElementById('tabPending');
  const tabDone = document.getElementById('tabDone');
  const addRow = document.getElementById('addRow');
  const newTaskBtn = document.getElementById('newTaskBtn');
  const newTaskOverlay = document.getElementById('newTaskOverlay');
  const sortSelect = document.getElementById('sortSelect');
  const repeatSelect = document.getElementById('repeatSelect');
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

  dateLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

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
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatDateDDMM(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '/' + month;
  }

  function formatFooterTimestamp(timestamp) {
    if (!timestamp) return 'never';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'never';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return day + '/' + month + ' ' + time;
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
    if (!iso) return '';
    const [yyyy, mm, dd] = iso.split('-');
    return dd + '-' + mm + '-' + yyyy.slice(2);
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
      if (!t.done && t.pending && t.dueDate && t.dueDate <= todayStr) {
        t.pending = false;
        changed = true;
      }
    });
    return changed;
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

  const VALID_THEMES = ['light', 'dark', 'colourful', 'notebook', 'forest', 'ocean', 'sunset', 'slate', 'bw', 'wb', 'terminal'];

  function applyTheme(theme) {
    if (!VALID_THEMES.includes(theme)) theme = 'light';
    document.body.classList.remove('theme-dark', 'theme-colourful', 'theme-notebook', 'theme-forest', 'theme-ocean', 'theme-sunset', 'theme-slate', 'theme-bw', 'theme-wb', 'theme-terminal');
    if (theme !== 'light') {
      document.body.classList.add('theme-' + theme);
    }
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.theme === theme);
    });
  }

  async function selectTheme(theme) {
    applyTheme(theme);
    await queuedStorageSet(THEME_KEY, theme);
  }

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
  });

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
    copy.completedAt = null;
    copy.createdAt = Date.now();
    copy.dueDate = next;
    copy.subtasks = (item.subtasks || []).filter(x => x.type !== 'note').map(x => Object.assign({}, x, { id: uid(), done: false }));
    todos.push(copy);
    showToast('Repeating task: next one due ' + formatDate(next) + '.');
  }

  // ---------- sharing tasks with the other user ----------
  const ME = (new URLSearchParams(location.search).get('u') || '').toLowerCase();
  const USER_LIST = (window.TODO_CONFIG && TODO_CONFIG.users) || [];
  function userName(id) { const u = USER_LIST.find(x => x.id === id); return u ? u.name : id; }
  function otherUsers() { return USER_LIST.filter(u => u.id !== ME); }

  async function sendTaskTo(item, user) {
    const ok = await askConfirm('Send a copy of "' + item.text + '" to ' + user.name + '\'s list?', 'Send');
    if (!ok) return;
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = uid();
    copy.done = false;
    copy.pending = false;
    copy.completedAt = null;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.sentFrom = userName(ME);
    copy.assignedBy = userName(ME);
    copy.subtasks = (item.subtasks || []).map(x => Object.assign({}, x, { id: uid() }));
    try {
      await TodoGH.sendTask(user.id, copy, STORAGE_KEY);
      showToast('Sent to ' + user.name + '.');
    } catch (e) {
      showToast('Could not send: ' + e.message);
    }
  }

  // ---------- archiving old completed tasks ----------
  const ARCHIVE_DAYS = 90;
  const archiveStatusEl = document.getElementById('archiveStatus');
  function archiveSay(msg) { if (archiveStatusEl) archiveStatusEl.textContent = msg; }

  async function archiveOldCompleted(manual) {
    if (!TodoGH.cfg().token) {
      if (manual) showToast('Connect to GitHub first to use the archive.');
      return;
    }
    const cutoff = Date.now() - ARCHIVE_DAYS * 86400000;
    const old = todos.filter(t => t.done && t.completedAt && t.completedAt < cutoff);
    if (!old.length) {
      if (manual) showToast('Nothing completed more than ' + ARCHIVE_DAYS + ' days ago.');
      return;
    }
    try {
      await TodoGH.archiveTasks(ME, old);
      const ids = new Set(old.map(t => t.id));
      todos = todos.filter(t => !ids.has(t.id));
      render();
      save();
      showToast('Archived ' + old.length + ' completed task' + (old.length === 1 ? '' : 's') + ' older than ' + ARCHIVE_DAYS + ' days.');
      refreshArchiveCount();
    } catch (e) {
      if (manual) showToast('Could not archive: ' + e.message);
    }
  }

  async function refreshArchiveCount() {
    if (!TodoGH.cfg().token) { archiveSay('Connect to GitHub to use the archive.'); return; }
    try {
      const a = await TodoGH.readArchive(ME);
      archiveSay(a.length + ' task' + (a.length === 1 ? '' : 's') + ' in the archive.');
    } catch (e) { archiveSay(''); }
  }

  async function restoreArchive() {
    try {
      const a = await TodoGH.readArchive(ME);
      if (!a.length) { showToast('The archive is empty.'); return; }
      const have = new Set(todos.map(t => t.id));
      a.forEach(t => { if (!have.has(t.id)) todos.push(t); });
      await TodoGH.clearArchive(ME);
      render();
      save();
      showToast('Restored ' + a.length + ' task' + (a.length === 1 ? '' : 's') + ' from the archive.');
      refreshArchiveCount();
    } catch (e) {
      showToast('Could not restore: ' + e.message);
    }
  }

  document.getElementById('archiveNowBtn').addEventListener('click', () => archiveOldCompleted(true));
  document.getElementById('restoreArchiveBtn').addEventListener('click', restoreArchive);
  document.getElementById('settingsBtn').addEventListener('click', refreshArchiveCount);

  // once a day, quietly archive on load
  setTimeout(() => {
    try {
      const k = 'todo_last_archive_' + ME;
      if (Date.now() - (parseInt(localStorage.getItem(k), 10) || 0) < 86400000) return;
      localStorage.setItem(k, String(Date.now()));
    } catch (e) { /* storage unavailable: archive anyway */ }
    archiveOldCompleted(false);
  }, 8000);

  // pick up changes another device saved to GitHub
  window.addEventListener('todo-remote-update', async () => {
    try {
      const beforeIds = new Set(todos.map(t => t.id));
      const r = await storageGet(STORAGE_KEY);
      todos = r ? JSON.parse(r.value) : [];
      const received = todos.filter(t => t.sentFrom && !beforeIds.has(t.id) && !t.seenSent);
      if (received.length) {
        received.forEach(t => { t.seenSent = true; });
        showToast(received[0].sentFrom + ' sent you ' + (received.length === 1 ? '"' + received[0].text + '"' : received.length + ' tasks') + '.');
        save();
      }
      const c = await storageGet(CATEGORIES_KEY);
      if (c) { const a = JSON.parse(c.value); if (Array.isArray(a)) categories = a; }
      const a2 = await storageGet(ASSIGNEES_KEY);
      if (a2) { const a = JSON.parse(a2.value); if (Array.isArray(a)) assignees = a; }
      const b = await storageGet(ASSIGNED_BY_KEY);
      if (b) { const a = JSON.parse(b.value); if (Array.isArray(a)) assignedByOptions = a; }
      populateCategorySelect(); renderCategoryList(); populateAssigneeChecklist(); renderAssigneeList(); populateAssignedBySelect(); renderAssignedByList();
      render();
    } catch (e) { /* keep what is on screen */ }
  });

  async function load() {
    try {
      const themeResult = await storageGet(THEME_KEY);
      applyTheme(themeResult && themeResult.value ? themeResult.value : 'light');
    } catch (e) {
      applyTheme('light');
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
    updateFooterStatus();
    populateCategorySelect();
    renderCategoryList();
    populateAssigneeChecklist();
    renderAssigneeList();
    populateAssignedBySelect();
    renderAssignedByList();
    updateSecurityUI();
    if (passwordHash) {
      showLock();
    }
    render();
    if (!passwordHash) {
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
    } finally {
      saveInFlight = false;
      if (savePending) {
        savePending = false;
        save();
      }
    }
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
      .filter(t => {
        if (page !== 'active' || !filterMode) return true;
        if (filterMode === 'dueToday') return t.dueDate === todayStr;
        if (filterMode === 'overdue') return isPastDue(t.dueDate);
        return true;
      })
      .sort(sortComparators[sortBy] || sortComparators.priority);

    const filterIndicator = document.getElementById('filterIndicator');
    const filterIndicatorText = document.getElementById('filterIndicatorText');
    if (page === 'active' && filterMode) {
      filterIndicator.style.display = 'flex';
      filterIndicatorText.textContent = 'Showing: ' + (filterMode === 'dueToday' ? 'Due Today' : 'Overdue') + ' (' + visible.length + ')';
    } else {
      filterIndicator.style.display = 'none';
    }

    document.getElementById('dueTodayStat').classList.toggle('filter-active', filterMode === 'dueToday');
    document.getElementById('overdueStat').classList.toggle('filter-active', filterMode === 'overdue');
    document.getElementById('dueTodayTopTrigger').classList.toggle('filter-active', filterMode === 'dueToday');
    document.getElementById('overdueTopTrigger').classList.toggle('filter-active', filterMode === 'overdue');

    listHeader.style.display = visible.length === 0 ? 'none' : 'grid';
    listHeader.classList.toggle('grid-done', page === 'done');
    lhCompleted.style.display = page === 'done' ? 'block' : 'none';

    if (visible.length === 0) {
      emptyMsg.textContent = searchTerm
        ? 'No tasks match "' + searchInput.value.trim() + '".'
        : page === 'active'
        ? (filterMode ? 'No tasks match this filter.' : 'Nothing on the list. Add your first task above.')
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
        li.className = 'item' + (item.done ? ' done' : '') + (isDueToday ? ' due-today' : '') + (isRowOverdue ? ' overdue-row' : '');

        const box = document.createElement('div');
        box.className = 'box';
        box.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';
        box.addEventListener('click', () => toggle(item.id));

        const taskText = document.createElement('div');
        taskText.className = 'task-text' + (item.priority === 'high' ? ' high-priority' : '');
        taskText.textContent = item.text;

        const categoryCell = document.createElement('div');
        categoryCell.className = 'cell cell-category';
        if (item.category) {
          const categoryTag = document.createElement('span');
          categoryTag.className = 'category-tag';
          categoryTag.textContent = item.category;
          categoryCell.appendChild(categoryTag);
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
          dueCell.textContent = isOverdue ? 'Overdue' : formatDate(item.dueDate);
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

        row.appendChild(priorityTag);
        row.appendChild(stamp);
        li.appendChild(row);

        taskText.addEventListener('click', () => toggleExpanded(item.id));

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
            taskText.textContent = editName.value;
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

          editMetaRow.appendChild(editDue);
          editMetaRow.appendChild(editPriority);
          editMetaRow.appendChild(editCategory);

          editFields.appendChild(editName);
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
                if (e.key === 'Escape') { editInput.value = sub.text; editInput.blur(); }
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
          addSubtaskInput.placeholder = 'Add a subtask or note... (Enter to add, Shift+Enter for a new line, or Save task)';
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

          const saveTaskBtn = document.createElement('button');
          saveTaskBtn.className = 'save-task';
          saveTaskBtn.textContent = 'Save task';
          saveTaskBtn.addEventListener('click', () => {
            const pendingSubtask = addSubtaskInput.value.trim();
            if (pendingSubtask) {
              const entryType = addEntryTypeByItem[item.id] || 'subtask';
              item.subtasks.push({ id: uid(), text: pendingSubtask, done: false, type: entryType, createdAt: Date.now() });
              addSubtaskInput.value = '';
              delete subtaskDrafts[item.id];
            }
            save();
            render();
          });

          const closeTaskBtn = document.createElement('button');
          closeTaskBtn.type = 'button';
          closeTaskBtn.className = 'close-task';
          closeTaskBtn.textContent = 'Close';
          closeTaskBtn.addEventListener('click', () => {
            toggleExpanded(item.id);
          });

          let pendingToggleBtn = null;
          let markCompleteBtn = null;
          if (!item.done) {
            pendingToggleBtn = document.createElement('button');
            pendingToggleBtn.type = 'button';
            pendingToggleBtn.className = 'pending-toggle';
            pendingToggleBtn.textContent = item.pending ? 'Move to Active' : 'Move to Pending';
            pendingToggleBtn.addEventListener('click', () => {
              item.pending = !item.pending;
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
            }
          }

          const sendBtns = otherUsers().map(u => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pending-toggle';
            b.textContent = 'Send copy to ' + u.name;
            b.addEventListener('click', () => sendTaskTo(item, u));
            return b;
          });

          panelFooter.appendChild(remove);
          if (cancelTaskDeleteBtn) panelFooter.appendChild(cancelTaskDeleteBtn);
          sendBtns.forEach(b => panelFooter.appendChild(b));
          if (pendingToggleBtn) panelFooter.appendChild(pendingToggleBtn);
          if (markCompleteBtn) panelFooter.appendChild(markCompleteBtn);
          panelFooter.appendChild(saveTaskBtn);

          panel.appendChild(editFields);
          panel.appendChild(subtaskListTitle);
          panel.appendChild(subtaskList);
          panel.appendChild(addSubtaskRow);
          panel.appendChild(panelFooter);
          panel.appendChild(closeTaskBtn);
          li.appendChild(panel);
        }

        listEl.appendChild(li);
      });
    }

    const remaining = todos.filter(t => !t.done && !t.pending).length;
    const pendingCount = todos.filter(t => !t.done && t.pending).length;
    const completed = todos.filter(t => t.done).length;
    countLabel.textContent = page === 'active'
      ? remaining + (remaining === 1 ? ' item left' : ' items left')
      : page === 'pending'
        ? pendingCount + (pendingCount === 1 ? ' item pending' : ' items pending')
        : completed + (completed === 1 ? ' item completed' : ' items completed');

    newTaskOverlay.classList.toggle('open', page === 'active' && addFormOpen);
    newTaskBtn.style.display = page === 'active' ? 'block' : 'none';
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

    document.getElementById('dueTodayStat').classList.toggle('flash', dueTodayCount > 0);
    document.getElementById('overdueStat').classList.toggle('flash', overdueCount > 0);
    document.getElementById('dueTodayTopTrigger').classList.toggle('flash', dueTodayCount > 0);
    document.getElementById('overdueTopTrigger').classList.toggle('flash', overdueCount > 0);
  }

  function setPage(next) {
    page = next;
    if (page !== 'active') filterMode = null;
    tabActive.classList.toggle('active', page === 'active');
    tabPending.classList.toggle('active', page === 'pending');
    tabDone.classList.toggle('active', page === 'done');
    [tabActive, tabPending, tabDone].forEach(function (b) { b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false'); });
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
      '<li><span class="due-summary-task">' + escapeHtml(t.text) + '</span>' +
      '<span class="due-summary-date">' + escapeHtml(formatDate(t.dueDate)) + '</span></li>'
    ).join('');
    return '<div class="due-summary-section' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="due-summary-title">' + title + ' (' + items.length + ')</div>' +
      '<ul class="due-summary-list">' + rows + '</ul>' +
      '</div>';
  }

  function maybeShowDueSummary() {
    const { overdue, dueToday, dueThisWeek } = getDueSummaryData();
    if (overdue.length === 0 && dueToday.length === 0 && dueThisWeek.length === 0) return;

    const body = document.getElementById('dueSummaryBody');
    body.innerHTML =
      buildDueSummarySection('Overdue', overdue, 'overdue') +
      buildDueSummarySection('Due Today', dueToday) +
      buildDueSummarySection('Due This Week', dueThisWeek);

    document.getElementById('dueSummaryOverlay').classList.add('open');
  }

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
    todos.push({ id: uid(), text: value, done: false, createdAt: Date.now(), priority, dueDate, category, assignedTo, assignees: taskAssignees, assignedBy, repeat });
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

  function toggleExpanded(id) {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
    render();
  }

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
      item.done = !item.done;
      item.completedAt = item.done ? Date.now() : null;
      if (item.done) { item.pending = false; spawnNextRepeat(item); }
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
      notes: headers.indexOf('notes')
    };

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
        completedAt
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

    if (importedCount === 0) {
      showImportStatus('No valid tasks found in that file.', 'error');
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
    showImportStatus('Imported ' + importedCount + (importedCount === 1 ? ' task.' : ' tasks.'), 'success');
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
    const headers = ['Task', 'Status', 'Priority', 'Category', 'Assigned To', 'Assigned By', 'Created', 'Due', 'Completed', 'Subtasks'];
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
      summarizeSubtasks(item)
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
    page = 'active';
    tabActive.classList.add('active');
    tabDone.classList.remove('active');
    render();
  }

  document.getElementById('dueTodayStat').addEventListener('click', () => toggleFilter('dueToday'));
  document.getElementById('overdueStat').addEventListener('click', () => toggleFilter('overdue'));
  document.getElementById('dueTodayTopTrigger').addEventListener('click', () => toggleFilter('dueToday'));
  document.getElementById('overdueTopTrigger').addEventListener('click', () => toggleFilter('overdue'));
  document.getElementById('pendingStat').addEventListener('click', () => setPage('pending'));
  document.getElementById('pendingTopTrigger').addEventListener('click', () => setPage('pending'));
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    filterMode = null;
    render();
  });

  function closeNewTaskWindow() {
    input.value = '';
    prioritySelect.value = 'medium';
    dueDateInput.value = '';
    categorySelect.value = '';
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

  tabActive.addEventListener('click', () => setPage('active'));
  tabPending.addEventListener('click', () => setPage('pending'));
  tabDone.addEventListener('click', () => setPage('done'));

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
    unlockInput.value = '';
    unlockError.textContent = '';
    lockOverlay.classList.add('open');
    closeSettings();
  }

  function hideLock() {
    lockOverlay.classList.remove('open');
  }

  async function attemptUnlock() {
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
