const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function loadPlugin() {
  const configPlugins = {
    withGradleProperties: (config, action) => ({
      ...config,
      properties: action,
    }),
    withAppBuildGradle: (config, action) => ({ ...config, gradle: action }),
  };
  const localRequire = (id) =>
    id === 'expo/config-plugins'
      ? configPlugins
      : id.startsWith('./')
        ? require(path.join(root, id))
        : require(id);
  localRequire.resolve = (id) => id;
  const context = {
    require: localRequire,
    module: { exports: {} },
    __dirname: root,
    process,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'app.plugin.js'), 'utf8'),
    context
  );
  return context.module.exports;
}

for (const language of ['groovy', 'kt']) {
  test(`${language}: adds Godot asset configuration on a clean prebuild`, () => {
    const config = loadPlugin()({});
    const original = 'android {\n    namespace = "test.app"\n}\n';
    const run = (contents) =>
      config.gradle({ modResults: { language, contents } }).modResults.contents;
    const output = run(original);
    assert.ok(output.startsWith(original.trimEnd()));
    assert.match(output, /ignoreAssetsPattern = \(ignoreAssetsPattern \?:/);
    assert.match(output, /it != "\.\*" && it != "<dir>\.\*"/);
    assert.ok(output.includes(language === 'groovy' ? '.findAll' : '.filter'));
    assert.equal(run(output), output);
    // Recreating the native project must regenerate the same configuration.
    assert.equal(run(original), output);
  });
}

test('keeps custom asset exclusions and places the fix after app configuration', () => {
  const original = `android {
    androidResources { ignoreAssetsPattern = "custom:.*:<dir>.*:!CVS" }
}
`;
  const config = loadPlugin()({});
  const output = config.gradle({
    modResults: { language: 'groovy', contents: original },
  }).modResults.contents;
  assert.ok(output.startsWith(original.trimEnd()));
  assert.ok(
    output.indexOf('begin react-native-godot-assets') > original.length
  );
});

test('rejects an unsupported Gradle language', () => {
  const config = loadPlugin()({});
  assert.throws(
    () => config.gradle({ modResults: { language: 'unknown', contents: '' } }),
    /Unsupported app Gradle language/
  );
});
