const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const pluginPath = path.join(root, '.yarn/plugins/ensure-prebuilts.cjs');
const { packageManager } = require('../../package.json');

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-yarn-install-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const manifest = {
    name: 'prebuilt-install-test',
    private: true,
    packageManager,
    scripts: { postinstall: 'node scripts/download-prebuilt.js' },
    prebuiltFiles: [{ version: 'one' }],
  };
  const save = () =>
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify(manifest, null, 2)
    );
  save();
  fs.writeFileSync(
    path.join(cwd, '.yarnrc.yml'),
    `nodeLinker: node-modules\nplugins:\n  - path: ${JSON.stringify(pluginPath)}\n`
  );
  fs.mkdirSync(path.join(cwd, 'scripts'));
  // Simulate the existing downloader without network, archives, or native builds.
  fs.writeFileSync(
    path.join(cwd, 'scripts/download-prebuilt.js'),
    `const fs = require('node:fs');
const path = require('node:path');
const p = require('../package.json');
if (p.failDownload) process.exit(17);
const dir = path.join(__dirname, '../artifacts', p.prebuiltFiles[0].version);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'ready'), 'downloaded');
`
  );
  const install = (...args) =>
    spawnSync('yarn', ['install', ...args], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        YARN_ENABLE_NETWORK: '0',
        YARN_ENABLE_TELEMETRY: '0',
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
        YARN_ENABLE_SCRIPTS: 'false',
        COREPACK_ENABLE_NETWORK: '0',
      },
      timeout: 30000,
    });
  return { cwd, manifest, save, install };
}

function success(result) {
  assert.equal(
    result.status,
    0,
    `${result.error || ''}\n${result.stdout}\n${result.stderr}`
  );
}

test('yarn restores prebuilts after metadata changes and missing cached outputs', (t) => {
  const f = fixture(t);
  success(f.install());
  assert.ok(fs.existsSync(path.join(f.cwd, 'artifacts/one/ready')));

  // No dependency or lifecycle-script changes: cached postinstall is insufficient.
  f.manifest.prebuiltFiles[0].version = 'two';
  f.save();
  success(f.install());
  const output = path.join(f.cwd, 'artifacts/two');
  assert.ok(fs.existsSync(path.join(output, 'ready')));

  fs.rmSync(output, { recursive: true });
  success(f.install());
  assert.ok(fs.existsSync(path.join(output, 'ready')));
});

test('yarn skip-build does not fetch prebuilts', (t) => {
  const f = fixture(t);
  success(f.install('--mode=skip-build'));
  assert.equal(fs.existsSync(path.join(f.cwd, 'artifacts')), false);
});

test('a failed download fails yarn even when postinstall was cached', (t) => {
  const f = fixture(t);
  success(f.install());
  f.manifest.failDownload = true;
  f.save();
  const result = f.install();
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(
    result.stdout + result.stderr,
    /download-prebuilt|Command failed/
  );
});
