const { installNodeCompat } = require('./node');

describe('Electron 22 Node Web API compatibility', () => {
  test('installs fetch, streaming and clone APIs into an older runtime', async () => {
    const target = {};
    installNodeCompat(target);
    for (const name of ['fetch', 'Headers', 'Request', 'Response', 'FormData', 'File', 'Blob', 'ReadableStream', 'TransformStream']) {
      expect(typeof target[name]).toBe('function');
    }
    expect(await new target.Response('compatible').text()).toBe('compatible');
    const original = { bytes: new Uint8Array([1, 2]), nested: { value: 3 } };
    original.self = original;
    const copy = target.structuredClone(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
    expect(Array.from(copy.bytes)).toEqual([1, 2]);
    expect(copy.self).toBe(copy);
  });

  test('does not replace existing APIs and is idempotent', () => {
    const fetch = jest.fn();
    const target = { fetch };
    installNodeCompat(target);
    const Response = target.Response;
    installNodeCompat(target);
    expect(target.fetch).toBe(fetch);
    expect(target.Response).toBe(Response);
  });
});
