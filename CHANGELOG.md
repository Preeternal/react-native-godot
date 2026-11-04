# Releases

## Unreleased

### Features

- Expo and monorepo support now resolves React Native from the package's actual
  location. The Expo config plugin applies the required Android settings and
  locates the downloaded LibGodot repository automatically.
- Package installation downloads and verifies the prebuilt LibGodot
  `4.5.1.preeternal.1` artifacts on demand instead of shipping them inside the
  npm package.
- Added compatibility with Expo SDK 57, React Native 0.86, React 19, the New
  Architecture, and `react-native-worklets`.

### Fixes

- Stabilized embedded rendering on iOS: the rendering layer follows its host
  view, preserves Retina scale, handles lifecycle and the first resize more
  reliably, and avoids unnecessary rendering work.
- Hardened the Android bridge: JNI entry points survive R8, worker state is
  ready before the Godot thread starts, repeated `resume` calls do not create
  duplicate frame callbacks, and host pause/resume is forwarded without
  changing the preview's explicit pause state.
- Fixed Fabric view initialization for React Native 0.88.

### Breaking changes

- `react-native-worklets` replaces `react-native-worklets-core`. Consumers must
  install and configure the Worklets package.
- Android support now requires Android 10 (API 29) or newer and the supported
  ARM ABIs: `armeabi-v7a` and `arm64-v8a`.

### Performance

- Reduced the release LibGodot binary size: Android release artifacts keep
  native debug symbols in a separate archive, while iOS release frameworks
  remove non-public symbols and retain the symbols required by the bridge.

### Maintenance

- Modernized the Android Gradle integration by removing deprecated Gradle APIs,
  late prefab callbacks, and the unused Kotlin plugin.

---
