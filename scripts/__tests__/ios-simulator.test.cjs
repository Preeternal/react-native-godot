const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('iOS preflight rejects missing or incompatible Simulator binaries', () => {
  const result = spawnSync(
    'python3',
    [path.join(__dirname, 'test_ios_simulator.py'), '-v'],
    {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    }
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});
