const streams = require('node:stream/web');
const { Blob } = require('node:buffer');
const { webcrypto } = require('node:crypto');

const installNodeCompat = (target = globalThis) => {
  for (const name of ['ReadableStream', 'WritableStream', 'TransformStream', 'TextEncoderStream', 'TextDecoderStream']) {
    if (typeof target[name] === 'undefined' && streams[name]) {
      target[name] = streams[name];
    }
  }
  if (typeof target.Blob === 'undefined') target.Blob = Blob;
  if (typeof target.crypto === 'undefined') target.crypto = webcrypto;
  if (typeof target.DOMException === 'undefined') {
    target.DOMException = require('node-domexception');
  }

  if (['fetch', 'Headers', 'Request', 'Response', 'FormData', 'File'].some((name) => typeof target[name] === 'undefined')) {
    const undici = require('undici');
    for (const name of ['fetch', 'Headers', 'Request', 'Response', 'FormData', 'File']) {
      if (typeof target[name] === 'undefined') target[name] = undici[name];
    }
  }
  if (typeof target.structuredClone === 'undefined') {
    target.structuredClone = require('@ungap/structured-clone').default;
  }
};

module.exports = { installNodeCompat };
