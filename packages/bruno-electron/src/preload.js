const { ipcRenderer, contextBridge, webUtils } = require('electron');
const {
  isAllowedInvokeChannel,
  isAllowedSendChannel,
  isAllowedListenChannel
} = require('./ipc/channels');

const assertAllowedChannel = (allowed, type, channel) => {
  if (!allowed(channel)) {
    throw new Error(`Blocked IPC ${type} channel: ${channel}`);
  }
};

contextBridge.exposeInMainWorld('isPlaywright', process.env.PLAYWRIGHT === 'true');

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => {
    if (!isAllowedInvokeChannel(channel)) {
      return Promise.reject(new Error(`Blocked IPC invoke channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel, ...args) => {
    assertAllowedChannel(isAllowedSendChannel, 'send', channel);
    return ipcRenderer.send(channel, ...args);
  },
  on: (channel, handler) => {
    assertAllowedChannel(isAllowedListenChannel, 'listener', channel);
    // Deliberately strip event as it includes `sender`
    const subscription = (event, ...args) => {
      // Ensure args is always an array to prevent undefined errors
      const safeArgs = args && args.length ? args : [];
      handler(...safeArgs);
    };
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  removeAllListeners: (channel) => {
    assertAllowedChannel(isAllowedListenChannel, 'listener', channel);
    return ipcRenderer.removeAllListeners(channel);
  },
  getFilePath(file) {
    return webUtils?.getPathForFile?.(file) || file?.path || '';
  },
  openExternal: (url) => {
    return ipcRenderer.invoke('renderer:open-external', url);
  }
});
