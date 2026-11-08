const path = require('node:path');
function loadExpoConfigPlugins() {
  const searchPaths = [
    __dirname,
    process.cwd(),
    path.join(__dirname, 'example'),
  ];
  for (const searchPath of searchPaths) {
    try {
      return require(
        require.resolve('expo/config-plugins', { paths: [searchPath] })
      );
    } catch {
      // Continue until the plugin is resolved from the consuming app.
    }
  }
  throw new Error(
    'Expo config plugins are required to use the Godot config plugin.'
  );
}

const {
  IOSConfig,
  withAppBuildGradle,
  withGradleProperties,
  withXcodeProject,
} = loadExpoConfigPlugins();
const { resolvePrebuiltConfig } = require('./scripts/prebuilt-config');

const ANDROID_PROPERTIES = {
  'android.minSdkVersion': '29',
  'reactNativeArchitectures': 'armeabi-v7a,arm64-v8a',
};
const GODOT_MAVEN_PROPERTY = 'android.extraMavenRepos';
const GODOT_ASSET_PATTERN =
  '!.svn:!.git:!.ds_store:!*.scc:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~';
const GODOT_ASSETS_START = '// @generated begin react-native-godot-assets';
const GODOT_ASSETS_END = '// @generated end react-native-godot-assets';

function setGradleProperty(properties, key, value) {
  const property = properties.find(
    (entry) => entry.type === 'property' && entry.key === key
  );

  if (property) {
    property.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

function isGodotMavenRepository(repository) {
  return (
    repository &&
    typeof repository.url === 'string' &&
    /\/android\/libs\/libgodot-android\/[^/]+\/?$/.test(
      repository.url.replaceAll('\\', '/')
    )
  );
}

function addGodotMavenRepository(properties, platformProjectRoot) {
  const libGodotAndroid = resolvePrebuiltConfig(
    platformProjectRoot
  ).prebuiltFiles.find((entry) => entry.name === 'libgodot-android');
  const property = properties.find(
    (entry) => entry.type === 'property' && entry.key === GODOT_MAVEN_PROPERTY
  );
  let repositories = [];

  if (property) {
    repositories = JSON.parse(property.value);
    if (!Array.isArray(repositories)) {
      throw new Error(`${GODOT_MAVEN_PROPERTY} must be a JSON array`);
    }
  }

  const repositoryPath = path
    .relative(
      path.join(platformProjectRoot, 'app'),
      path.join(
        __dirname,
        'android',
        'libs',
        'libgodot-android',
        libGodotAndroid.version
      )
    )
    .split(path.sep)
    .join('/');
  repositories = repositories.filter(
    (repository) => !isGodotMavenRepository(repository)
  );
  repositories.push({ url: repositoryPath });
  setGradleProperty(
    properties,
    GODOT_MAVEN_PROPERTY,
    JSON.stringify(repositories)
  );
}

function withGodotAndroid(config) {
  config = withGradleProperties(config, (projectConfig) => {
    for (const [key, value] of Object.entries(ANDROID_PROPERTIES)) {
      setGradleProperty(projectConfig.modResults, key, value);
    }
    addGodotMavenRepository(
      projectConfig.modResults,
      projectConfig.modRequest.platformProjectRoot
    );

    return projectConfig;
  });
  config = withAppBuildGradle(config, (projectConfig) => {
    const { language, contents } = projectConfig.modResults;
    if (language !== 'groovy' && language !== 'kt') {
      throw new Error(`Unsupported app Gradle language: ${language}`);
    }
    const filter =
      language === 'kt'
        ? '.filter { it != ".*" && it != "<dir>.*" }.joinToString(":")'
        : '.findAll { it != ".*" && it != "<dir>.*" }.join(":")';
    const block = `${GODOT_ASSETS_START}
android {
    androidResources {
        // Keep Godot's hidden runtime assets while preserving other exclusions.
        ignoreAssetsPattern = (ignoreAssetsPattern ?: "${GODOT_ASSET_PATTERN}").split(":")${filter}
    }
}
${GODOT_ASSETS_END}`;
    // Replace our previous block on repeated prebuilds; place it after existing
    // app configuration so a template's asset pattern cannot override it.
    projectConfig.modResults.contents =
      contents
        .replace(
          /\/\/ @generated begin react-native-godot-assets[\s\S]*?\/\/ @generated end react-native-godot-assets\n?/g,
          ''
        )
        .trimEnd() + `\n\n${block}\n`;
    return projectConfig;
  });
  return config;
}

function withGodotPacks(config, iosPacks) {
  if (!iosPacks.length) {
    return config;
  }

  return withXcodeProject(config, (projectConfig) => {
    const project = projectConfig.modResults;
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');

    for (const pack of iosPacks) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: pack,
        groupName: 'Resources',
        isBuildFile: true,
        project,
        verbose: true,
      });
    }

    return projectConfig;
  });
}

module.exports = (config, { iosPacks = [] } = {}) =>
  withGodotPacks(withGodotAndroid(config), iosPacks);
