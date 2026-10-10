const { webcrypto, createHash, createHmac } = require('node:crypto');

describe('EdgeGrid Web Crypto initialization', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  afterEach(() => {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as any).crypto;
    jest.resetModules();
  });

  const loadWithoutCrypto = () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    return require('./edgegrid');
  };

  it('allows parsing-only consumers to import without Web Crypto', async () => {
    const helpers = loadWithoutCrypto();
    expect(helpers.canonicalizeHeaders('Host', { Host: 'example.com' })).toBe('host:example.com');
    await expect(helpers.base64Sha256('test')).rejects.toThrow('EdgeGrid signing requires Web Crypto');
  });

  it('uses Web Crypto installed after import for SHA-256 and HMAC', async () => {
    const helpers = loadWithoutCrypto();
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    expect(await helpers.base64Sha256('test')).toBe(createHash('sha256').update('test').digest('base64'));
    expect(await helpers.base64HmacSha256('test', 'key')).toBe(createHmac('sha256', 'key').update('test').digest('base64'));
    expect(helpers.makeEdgeGridNonce()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
