const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pspYoutubeAuth', {
  saveSession: () => ipcRenderer.invoke('youtube-auth:save'),
});
