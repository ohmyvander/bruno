const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectPE } = require('./check-win7-package');

const pe = (machine = 0x8664, major = 6, minor = 0) => {
  const bytes = Buffer.alloc(256);
  bytes.write('MZ');
  bytes.writeUInt32LE(64, 60);
  bytes.writeUInt32LE(0x4550, 64);
  bytes.writeUInt16LE(machine, 68);
  bytes.writeUInt16LE(0x20b, 88);
  bytes.writeUInt16LE(major, 128);
  bytes.writeUInt16LE(minor, 130);
  bytes.writeUInt16LE(major, 136);
  bytes.writeUInt16LE(minor, 138);
  return bytes;
};

test('accepts x64 PE images targeting Vista or Win7', () => {
  assert.equal(inspectPE(pe()).osVersion, '6.0');
  assert.equal(inspectPE(pe(0x8664, 6, 1)).subsystemVersion, '6.1');
});

test('rejects Windows 8+, ia32 and arm64 PE images', () => {
  assert.throws(() => inspectPE(pe(0x8664, 6, 2)), /requires Windows/);
  assert.throws(() => inspectPE(pe(0x8664, 10, 0)), /requires Windows/);
  assert.throws(() => inspectPE(pe(0x14c)), /x64/);
  assert.throws(() => inspectPE(pe(0xaa64)), /x64/);
});

test('rejects malformed or truncated headers', () => {
  assert.throws(() => inspectPE(Buffer.alloc(10)), /DOS header/);
  const bytes = pe();
  bytes.writeUInt32LE(250, 60);
  assert.throws(() => inspectPE(bytes), /Truncated PE/);
});
