import { cancelGrpcRequest, endGrpcStream, isGrpcConnectionActive } from './index';

beforeEach(() => { window.ipcRenderer = { invoke: jest.fn() }; });
afterEach(() => { delete window.ipcRenderer; });

test('uses registered gRPC cancel and end handlers with their expected payloads', async () => {
  window.ipcRenderer.invoke.mockResolvedValue({ success: true });
  await cancelGrpcRequest('request-1');
  await endGrpcStream('request-1');
  expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('grpc:cancel-request', { requestId: 'request-1' });
  expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('grpc:end-request', { requestId: 'request-1' });
});

test('checks connection state through the registered active-connections handler', async () => {
  window.ipcRenderer.invoke.mockResolvedValue({ success: true, activeConnectionIds: ['request-1'] });
  expect(await isGrpcConnectionActive('request-1')).toBe(true);
  expect(await isGrpcConnectionActive('request-2')).toBe(false);
  expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('grpc:get-active-connections');
});
