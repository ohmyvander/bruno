jest.mock('workerpool', () => ({ pool: jest.fn(() => ({ exec: jest.fn(), terminate: jest.fn() })) }));
jest.mock('node:os', () => ({ availableParallelism: undefined, cpus: jest.fn(() => [{}, {}]) }));
const workerpool = require('workerpool');
const os = require('node:os');
const { Pool } = require('./index');

beforeEach(() => { jest.clearAllMocks(); });

test('falls back to CPU count when Node has no availableParallelism', () => {
  new Pool();
  expect(workerpool.pool).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxWorkers: 2 }));
});

test('honors explicit sizes without requiring a newer Node API', () => {
  new Pool({ size: 3 });
  expect(workerpool.pool).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxWorkers: 3 }));
  expect(os.cpus).not.toHaveBeenCalled();
});

test('always has at least one worker', () => {
  os.cpus.mockReturnValueOnce([]);
  new Pool();
  expect(workerpool.pool).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxWorkers: 1 }));
});
