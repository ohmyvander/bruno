const { createQuickJsNodeVariant } = require('./quickjs-module');

describe('quickjs module loader', () => {
  it('loads the wasm module loader through CommonJS for Electron 22 asar compatibility', async () => {
    const variant = createQuickJsNodeVariant();
    const moduleLoader = await variant.importModuleLoader();

    expect(variant.type).toBe('sync');
    expect(moduleLoader).toEqual(expect.any(Function));
  });
});
