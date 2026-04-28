const { newQuickJSWASMModule } = require('quickjs-emscripten');
const releaseSyncVariant = require('@jitl/quickjs-wasmfile-release-sync').default;
const emscriptenModule = require('@jitl/quickjs-wasmfile-release-sync/emscripten-module');

const createQuickJsNodeVariant = () => ({
  ...releaseSyncVariant,
  importModuleLoader: () => Promise.resolve(emscriptenModule.default || emscriptenModule)
});

const newQuickJsNodeWasmModule = () => {
  return newQuickJSWASMModule(createQuickJsNodeVariant());
};

module.exports = {
  createQuickJsNodeVariant,
  newQuickJsNodeWasmModule
};
