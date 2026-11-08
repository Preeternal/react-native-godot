const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const library = require('../package.json');

function findAppPackage(start) {
  let directory = path.resolve(start);
  while (true) {
    const filename = path.join(directory, 'package.json');
    if (fs.existsSync(filename)) {
      const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (manifest.name !== library.name) return { filename, manifest };
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function resolvePrebuiltConfig(appRoot) {
  const start =
    appRoot ||
    process.env.INIT_CWD ||
    process.env.npm_config_local_prefix ||
    process.cwd();
  const app = findAppPackage(start);
  const microphone = app?.manifest.reactNativeGodot?.microphone ?? false;
  if (typeof microphone !== 'boolean') {
    throw new Error(
      'reactNativeGodot.microphone must be a boolean in the app package.json.'
    );
  }
  return {
    microphone,
    appPackagePath: app?.filename ?? null,
    prebuiltFiles: library.prebuiltFiles.map(({ with_recording, ...entry }) =>
      microphone ? { ...entry, ...with_recording } : entry
    ),
  };
}

// Explicit CLI changes are saved in the app, so later installs and native
// dependency resolution select the same payload without editing node_modules.
function setMicrophone(appRoot, microphone) {
  const { appPackagePath } = resolvePrebuiltConfig(appRoot);
  if (!appPackagePath || path.dirname(appPackagePath) === packageRoot) {
    throw new Error(
      'Run the microphone selector from the consuming app, or pass --app-root <app>.'
    );
  }
  const contents = fs.readFileSync(appPackagePath, 'utf8');
  const manifest = JSON.parse(contents);
  manifest.reactNativeGodot = { ...manifest.reactNativeGodot, microphone };
  const indent = /\n([ \t]+)"/.exec(contents)?.[1] ?? '  ';
  fs.writeFileSync(
    appPackagePath,
    `${JSON.stringify(manifest, null, indent)}\n`
  );
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--app-root' && args[index + 1])
      options.appRoot = args[++index];
    else if (arg === '--with-recording') options.microphone = true;
    else if (arg === '--without-recording') options.microphone = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

module.exports = { resolvePrebuiltConfig, setMicrophone, parseArguments };

if (require.main === module) {
  const { appRoot } = parseArguments(process.argv.slice(2));
  process.stdout.write(JSON.stringify(resolvePrebuiltConfig(appRoot)));
}
