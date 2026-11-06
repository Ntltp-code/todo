/* config.js - the one place for users and storage settings. */
window.TODO_CONFIG = {
  users: [{ id: 'jonny', name: 'Jonny' }, { id: 'oj', name: 'OJ' }, { id: 'nick', name: 'Nick' }],
  dataRepo: 'ntltp-code/ntltp-private',
  branch: 'main',
  dir: 'data',
  pinSalt: 'todolist-v1',
  // who gets the daily briefing in place of the first Today pop-up of the day (add more ids to give it to others)
  briefingUsers: ['nick'],
  // who gets the Email button in the task window (add more ids to give it to others)
  emailTaskUsers: ['nick']
};
