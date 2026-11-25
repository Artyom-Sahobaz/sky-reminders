const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sky', {
  onReminder: (cb) => ipcRenderer.on('show-reminder', (_e, r) => cb(r)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, s) => cb(s)),
  setInteractive: (on) => ipcRenderer.send('set-interactive', on),
  empty: () => ipcRenderer.send('overlay-empty'),
  openLink: (url) => ipcRenderer.send('open-link', url),
  snooze: (id, minutes) => ipcRenderer.send('snooze', id, minutes),
  cancelReminders: (id) => ipcRenderer.send('cancel-reminders', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  test: (style, accountKey) => ipcRenderer.send('test', style, accountKey),
  getStatus: () => ipcRenderer.invoke('get-status'),
  accountAdd: (provider) => ipcRenderer.invoke('account-add', provider),
  accountRemove: (key) => ipcRenderer.invoke('account-remove', key),
  accountCancel: () => ipcRenderer.send('account-cancel'),
  welcomeDone: () => ipcRenderer.send('welcome-done'),
  openSettings: () => ipcRenderer.send('open-settings'),
});
