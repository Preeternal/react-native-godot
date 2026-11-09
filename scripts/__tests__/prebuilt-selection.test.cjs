const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { resolvePrebuiltConfig, setMicrophone } = require('../prebuilt-config');
const spmPlugin = require('../spm-autolinking-plugin');
const library = require('../../package.json');
const root = path.resolve(__dirname, '../..');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-selection-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const app = path.join(directory, 'app');
  fs.mkdirSync(path.join(app, 'ios'), { recursive: true });
  const manifestPath = path.join(app, 'package.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ name: 'consumer' }));
  return { directory, app, manifestPath };
}

test('defaults to .2 and switches the complete artifact set to .1', (t) => {
  const f = fixture(t);
  const standard = resolvePrebuiltConfig(f.app);
  assert.equal(standard.microphone, false);
  assert.equal(standard.prebuiltFiles.length, 4);
  assert.ok(
    standard.prebuiltFiles.every(
      (entry) => entry.version === '4.7.2.preeternal.2'
    )
  );
  assert.equal(
    standard.prebuiltFiles.find((entry) => entry.name === 'libgodot-android')
      .maven_version,
    '4.7.2.preeternal.2'
  );
  setMicrophone(f.app, true);
  const recording = resolvePrebuiltConfig(path.join(f.app, 'ios'));
  assert.ok(
    recording.prebuiltFiles.every(
      (entry) => entry.version === '4.7.2.preeternal.1'
    )
  );
  assert.equal(
    recording.prebuiltFiles.find((entry) => entry.name === 'libgodot-android')
      .maven_version,
    '4.7.2.preeternal.1-SNAPSHOT'
  );
  assert.ok(
    recording.prebuiltFiles.every(
      (entry) => !entry.filename.includes('no-record')
    )
  );
  setMicrophone(f.app, false);
  assert.deepEqual(
    resolvePrebuiltConfig(f.app).prebuiltFiles,
    standard.prebuiltFiles
  );
});

test('rejects a non-boolean microphone setting', (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    f.manifestPath,
    JSON.stringify({ reactNativeGodot: { microphone: 'false' } })
  );
  assert.throws(() => resolvePrebuiltConfig(f.app), /must be a boolean/);
});

for (const microphone of [false, true]) {
  test(`SPM selects only the ${microphone ? '.1 recording' : '.2 no-record'} binaries`, (t) => {
    const f = fixture(t);
    setMicrophone(f.app, microphone);
    const outputDir = path.join(f.app, 'ios/build/generated/autolinking');
    const context = { appRoot: f.app, outputDir };
    const result = spmPlugin(context);
    const manifestRoot = result.packageDependencies[0].path;
    const manifest = fs.readFileSync(
      path.join(manifestRoot, 'Package.swift'),
      'utf8'
    );
    assert.ok(manifest.startsWith('// swift-tools-version: 6.0\n'));
    const selection = resolvePrebuiltConfig(f.app);
    for (const entry of selection.prebuiltFiles.filter(
      (item) => item.destination_base_dir === 'ios/libs'
    )) {
      assert.ok(
        manifest.includes(`${entry.base_url}${entry.version}/${entry.filename}`)
      );
      assert.ok(manifest.includes(entry.shasum));
    }
    assert.equal((manifest.match(/\.binaryTarget\(/g) || []).length, 2);
    assert.ok(
      !manifest.includes(
        microphone ? '4.7.2.preeternal.2' : '4.7.2.preeternal.1'
      )
    );
    assert.match(manifest, /linkedFramework\("AVFAudio"\)/);
    const worklets = /name: "RNWorklets", path: "([^"]+)"/.exec(manifest)[1];
    assert.equal(
      path.resolve(manifestRoot, worklets),
      path.join(outputDir, 'libs/RNWorklets')
    );
    assert.ok(result.watchPaths.includes(f.manifestPath));
    spmPlugin(context);
    assert.equal(
      fs.readFileSync(path.join(manifestRoot, 'Package.swift'), 'utf8'),
      manifest
    );
  });
}

test('CocoaPods selects the same artifact paths as the downloader', (t) => {
  const f = fixture(t);
  for (const microphone of [false, true]) {
    setMicrophone(f.app, microphone);
    const actual = execFileSync(
      'ruby',
      [
        '-r',
        path.join(root, 'prebuilt-utils.rb'),
        '-e',
        'puts prebuilt_path("libgodot")',
      ],
      { cwd: f.app, encoding: 'utf8' }
    ).trim();
    const entry = resolvePrebuiltConfig(f.app).prebuiltFiles.find(
      (item) => item.name === 'libgodot'
    );
    assert.equal(
      actual,
      `${entry.destination_base_dir}/${entry.name}/${entry.version}`
    );
  }
});

test('static SwiftPM default matches the no-record release metadata', () => {
  const manifest = fs.readFileSync(path.join(root, 'Package.swift'), 'utf8');
  assert.match(manifest, /libGodotVersion = "4\.7\.2\.preeternal\.2"/);
  for (const entry of library.prebuiltFiles.filter(
    (item) => item.destination_base_dir === 'ios/libs'
  )) {
    assert.ok(manifest.includes(entry.filename));
    assert.ok(manifest.includes(entry.shasum));
  }
});

test('downloader persists CLI selection, fetches one set, preserves cached versions and verifies hashes', (t) => {
  const f = fixture(t);
  const installed = path.join(f.directory, 'library');
  fs.mkdirSync(path.join(installed, 'scripts'), { recursive: true });
  for (const filename of ['prebuilt-config.js', 'download-prebuilt.js']) {
    fs.copyFileSync(
      path.join(root, 'scripts', filename),
      path.join(installed, 'scripts', filename)
    );
  }
  const metadata = JSON.parse(JSON.stringify(library));
  const archives = { false: {}, true: {} };
  for (const entry of metadata.prebuiltFiles) {
    for (const microphone of [false, true]) {
      const source = path.join(f.directory, `${entry.name}-${microphone}`);
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, 'variant'), String(microphone));
      fs.symlinkSync('variant', path.join(source, 'variant-link'));
      const archive = `${source}.zip`;
      execFileSync('zip', ['-q', '-y', '-r', archive, '.'], { cwd: source });
      const hash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(archive))
        .digest('hex');
      (microphone ? entry.with_recording : entry).shasum = hash;
      archives[microphone][entry.env] = archive;
    }
  }
  const saveMetadata = () =>
    fs.writeFileSync(
      path.join(installed, 'package.json'),
      JSON.stringify(metadata)
    );
  saveMetadata();
  const run = (microphone, ...args) =>
    spawnSync(
      process.execPath,
      [
        path.join(installed, 'scripts/download-prebuilt.js'),
        '--app-root',
        f.app,
        ...args,
      ],
      {
        cwd: f.app,
        encoding: 'utf8',
        env: {
          ...process.env,
          SHASUM_CHECK: 'true',
          REPLACE_EXISTING: 'false',
          ...archives[microphone],
        },
      }
    );
  const success = (result) =>
    assert.equal(result.status, 0, result.stdout + result.stderr);
  success(run(false));
  assert.ok(
    !fs.existsSync(path.join(installed, 'ios/libs/libgodot/4.7.2.preeternal.1'))
  );
  success(run(true, '--with-recording'));
  assert.equal(
    JSON.parse(fs.readFileSync(f.manifestPath)).reactNativeGodot.microphone,
    true
  );
  // Dependency postinstall runs inside the library; INIT_CWD identifies the app.
  const postinstall = spawnSync(
    process.execPath,
    [path.join(installed, 'scripts/download-prebuilt.js')],
    {
      cwd: installed,
      encoding: 'utf8',
      env: {
        ...process.env,
        INIT_CWD: f.app,
        REPLACE_EXISTING: 'false',
      },
    }
  );
  success(postinstall);
  assert.match(postinstall.stdout, /microphone: enabled/);
  for (const entry of metadata.prebuiltFiles) {
    for (const microphone of [false, true]) {
      const version = microphone ? entry.with_recording.version : entry.version;
      assert.equal(
        fs.readFileSync(
          path.join(
            installed,
            entry.destination_base_dir,
            entry.name,
            version,
            'variant'
          ),
          'utf8'
        ),
        String(microphone)
      );
      assert.equal(
        fs.readlinkSync(
          path.join(
            installed,
            entry.destination_base_dir,
            entry.name,
            version,
            'variant-link'
          )
        ),
        'variant'
      );
    }
  }
  success(run(false, '--without-recording'));
  const failure = spawnSync(
    process.execPath,
    [path.join(installed, 'scripts/download-prebuilt.js'), '--app-root', f.app],
    {
      cwd: f.app,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...archives.true,
        REPLACE_EXISTING: 'true',
        SHASUM_CHECK: 'true',
      },
    }
  );
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /Checksum mismatch/);
  assert.equal(
    fs.readFileSync(
      path.join(installed, 'ios/libs/libgodot/4.7.2.preeternal.2/variant'),
      'utf8'
    ),
    'false'
  );
});
