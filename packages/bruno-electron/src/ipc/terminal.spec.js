const mockHandlers = {};
const mockListeners = {};
const mockTerminal = { onData: jest.fn(), onExit: jest.fn(), kill: jest.fn(), write: jest.fn(), resize: jest.fn() };
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel, callback) => { mockHandlers[channel] = callback; },
    on: (channel, callback) => { mockListeners[channel] = callback; }
  }
}));
jest.mock('node-pty', () => ({ spawn: jest.fn(() => mockTerminal) }));
jest.mock('electron-is-dev', () => false);
jest.mock('os', () => ({ release: jest.fn(() => '6.1.7601'), homedir: () => 'C:\\test' }));
const TerminalManager = require('./terminal');
const platform = Object.getOwnPropertyDescriptor(process, 'platform');

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  require('os').release.mockReturnValue('6.1.7601');
});
afterEach(() => Object.defineProperty(process, 'platform', platform));

const createSession = () => {
  const manager = new TerminalManager();
  const event = { sender: { isDestroyed: () => false, send: jest.fn() } };
  const id = mockHandlers['terminal:create'](event, { cwd: 'C:\\test' });
  const exit = mockTerminal.onExit.mock.calls[0][0];
  return { manager, event, id, exit };
};

test('natural Win7 shell exits release WinPTY handles and still notify the renderer', () => {
  const { manager, event, id, exit } = createSession();
  exit({ exitCode: 0 });
  expect(mockTerminal.kill).toHaveBeenCalledTimes(1);
  expect(manager.terminals.has(id)).toBe(false);
  expect(event.sender.send).toHaveBeenCalledWith(`terminal:exit:${id}`, { exitCode: 0, signal: undefined });
});

test('explicitly closed WinPTY sessions are not killed twice', () => {
  const { event, id, exit } = createSession();
  mockListeners['terminal:kill'](event, id);
  exit({ exitCode: 0 });
  expect(mockTerminal.kill).toHaveBeenCalledTimes(1);
});

test('modern Windows retains normal ConPTY exit behavior', () => {
  require('os').release.mockReturnValue('10.0.26200');
  const { exit } = createSession();
  exit({ exitCode: 0 });
  expect(mockTerminal.kill).not.toHaveBeenCalled();
});
