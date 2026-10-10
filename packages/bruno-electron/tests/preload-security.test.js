const mockElectron = {
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  webUtils: {
    getPathForFile: jest.fn()
  }
};

jest.mock('electron', () => mockElectron);

const loadPreloadApi = () => {
  jest.resetModules();
  mockElectron.contextBridge.exposeInMainWorld.mockClear();
  require('../src/preload');
  return mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(([key]) => key === 'ipcRenderer')[1];
};

describe('preload security bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectron.webUtils = {
      getPathForFile: jest.fn()
    };
    mockElectron.ipcRenderer.invoke.mockResolvedValue(undefined);
  });

  test('allows known invoke channels and rejects unknown channels', async () => {
    const api = loadPreloadApi();

    await api.invoke('renderer:ready');

    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith('renderer:ready');
    await expect(api.invoke('renderer:unknown-channel')).rejects.toThrow('Blocked IPC invoke channel: renderer:unknown-channel');
  });

  test('allows dynamic terminal listener channels and blocks unrelated listeners', () => {
    const api = loadPreloadApi();
    const handler = jest.fn();

    api.on('main:collection-import-started', handler);
    const unsubscribe = api.on('terminal:data:session-1', handler);

    expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith('main:collection-import-started', expect.any(Function));
    expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith('terminal:data:session-1', expect.any(Function));
    unsubscribe();
    expect(mockElectron.ipcRenderer.removeListener).toHaveBeenCalledWith('terminal:data:session-1', expect.any(Function));
    expect(() => api.on('evil:channel', handler)).toThrow('Blocked IPC listener channel: evil:channel');
  });

  test('uses File.path when Electron webUtils is unavailable', () => {
    mockElectron.webUtils = undefined;
    const api = loadPreloadApi();

    expect(api.getFilePath({ path: 'C:\\temp\\example.json' })).toBe('C:\\temp\\example.json');
  });

  test('allows new AI and storage channels without wildcard privileges', async () => {
    const api = loadPreloadApi();
    await api.invoke('renderer:get-ai-status');
    await api.invoke('datastore:file-index:file_index_size');
    api.send('renderer:ai-stream-text', { streamId: 'test' });
    api.on('main:ai-stream-chunk', jest.fn());
    expect(() => api.send('renderer:ai-arbitrary-command')).toThrow('Blocked IPC send channel');
    expect(() => api.on('main:ai-arbitrary-event', jest.fn())).toThrow('Blocked IPC listener channel');
    await expect(api.invoke('datastore:unknown:execute')).rejects.toThrow('Blocked IPC invoke channel');
  });

  test('opens external links through validated main-process IPC only', async () => {
    const api = loadPreloadApi();

    await api.openExternal('https://usebruno.com');

    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith('renderer:open-external', 'https://usebruno.com');
  });
});
