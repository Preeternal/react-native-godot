# Releases

## Unreleased

### Changed

- Default mobile prebuilts now use LibGodot `4.7.2.preeternal.2`, which excludes
  native microphone capture and iOS microphone permission API references while
  retaining audio playback. Most embedded 3D content does not need a microphone.
  Apple may require a purpose string for protected APIs referenced by bundled
  SDKs even when the app does not call them; excluding this code avoids that
  unnecessary microphone-related submission issue. See Apple's
  [Requesting access to protected resources](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources).
- Apps that need microphone capture can set `reactNativeGodot.microphone: true`
  in their own `package.json` to select the recording-capable
  `4.7.2.preeternal.1` artifacts and matching bindings. `postinstall`, the manual
  downloader, CocoaPods, Gradle and React Native's SwiftPM autolinking use the
  same selection; only the selected release set is downloaded.

### Added

- Downloader options `--with-recording` and `--without-recording` save the
  selection in the consuming app's `package.json` before downloading. No
  microphone or audio flags in Gradle, Podfile or Info.plist are required.
- Documented the Godot `Dummy` driver for silent content that should not
  interrupt music from another app; disabling playback is a project setting
  independent of the microphone-free default.

---

## v0.1.0 - First Public Release

First release of the maintained fork of the original
[@borndotcom/react-native-godot](https://github.com/borndotcom/react-native-godot), built on Migeran’s LibGodot integration.

### Features

- Migrated the package to the `create-react-native-library` 0.64.0 Turbo
  Module template and its React Native 0.88 tooling.
- Added a Swift Package Manager manifest for iOS integrations, including the
  LibGodot and React Native header dependencies used by the native targets.
- Expo Dev Builds remain supported through the package config plugin. The
  example itself is now the current React Native Community CLI template
  (React Native 0.88) rather than an old Expo example.
- Package installation downloads and verifies the prebuilt LibGodot
  `4.5.1.preeternal.1` artifacts on demand instead of shipping them inside the
  npm package. No need to call `download-prebuilt` manually.
- Added compatibility with React Native 0.88, React 19.3, the New
  Architecture, Hermes and `react-native-worklets` 0.13.

### Fixes

- Stabilized embedded rendering on iOS: the rendering layer follows its host
  view, preserves Retina scale, handles lifecycle and the first resize more
  reliably, and avoids unnecessary rendering work.
- Hardened the Android bridge: JNI entry points survive R8, worker state is
  ready before the Godot thread starts, repeated `resume` calls do not create
  duplicate frame callbacks, and host pause/resume is forwarded without
  changing the preview's explicit pause state.
- Fixed Fabric view initialization for React Native 0.88.
- Kept hidden `.godot` export assets in Android application bundles so Godot
  can load its exported scenes from `res://`; the Expo config plugin preserves
  this setting across clean prebuilds.

### Breaking changes

- Consumers migrating from the original package must update the dependency and
  imports to `@preeternal/react-native-godot`.
- `react-native-worklets` replaces `react-native-worklets-core`. Consumers must
  install and configure the Worklets package.
- Android support now requires Android 10 (API 29) or newer and the supported
  ARM ABIs: `armeabi-v7a` and `arm64-v8a`.

### Binary size

- Reduced the release LibGodot binary size: Android release artifacts keep
  native debug symbols in a separate archive, while iOS release frameworks
  remove non-public symbols and retain the symbols required by the bridge.

### Maintenance

- Migrated Android native modules and the Fabric view from Java to Kotlin while
  preserving the existing native module names and generated interfaces.
- Kept the Java implementation's early native-library loading on Android,
  since lazy loading triggers [Worklets issue #10922](https://github.com/software-mansion/react-native-reanimated/issues/10922).
- Updated the iOS native layout for the modern template and added Swift
  Package Manager support while retaining the Objective-C++ bridge where C++
  interop is required.
- Modernized the Android Gradle integration by removing deprecated Gradle APIs
  and late prefab callbacks.
- Updated the package tooling, TypeScript build, linting, tests and npm archive
  layout to the current template generation.

---
