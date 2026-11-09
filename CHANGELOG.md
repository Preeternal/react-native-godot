# Releases

## v0.2.0 — Godot 4.7, Metal & native lifecycle improvements

A Godot 4.7.2 integration for embedded Android and iOS scenes, with updated
native bindings, renderer selection and lifecycle handling. The public
`RTNGodot`, `RTNGodotView` and `runOnGodotThread` entry points remain available.

### Engine and rendering

- Migrated the Android and iOS bridge to Godot 4.7's native ABI, generated
  bindings and embedded surface APIs, including the updated Android services
  and JNI contract.
- Added target-aware iOS renderer selection before engine startup: Metal/Mobile
  on devices, OpenGL ES 3/Compatibility in Simulator. Device apps can explicitly
  choose Compatibility. Unsupported Simulator Metal requests fail before
  creating the engine instance.
- Retained Android OpenGL Compatibility and optional Vulkan/Mobile rendering.
  The example starts Android with Compatibility explicitly.
- Included engine fixes for mobile OpenGL orientation and drawable sizing,
  including iOS backing pixel dimensions and Android live surface size queries.

### Lifecycle and native views

- Guarded queued attach, resize and input work against a stopped engine or a
  replaced view attachment, preventing stale work from accessing old objects.
- Coalesced Android resize requests and applied them on the Godot thread
  without synchronously waiting on the UI thread. Native window references
  remain retained until replacement or detach completes.
- Fixed iOS rendering layer cleanup on Stop, kept window subscriptions separate
  for each host view, and restricted shared main-layer resize/input to its
  current owner. Preserved the preferred host across Stop/Start.
- Corrected Android surface stacking above the React Native drawing surface,
  and resolved iOS header conflicts and Fabric view initialization issues.

### Installation and audio

- Defaulted to LibGodot `4.7.2.preeternal.2`: audio playback remains enabled,
  while native microphone capture and iOS microphone permission API references
  are excluded at compile time. Apple can require a microphone purpose string
  for protected APIs referenced by bundled SDKs even when the app never records;
  runtime muting cannot remove those references. See Apple's
  [protected resource requirements](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources).
- Added `reactNativeGodot.microphone: true` in the app's `package.json` to
  select recording-capable `4.7.2.preeternal.1` with matching bindings.
  The downloader, CocoaPods, Gradle, Expo integration and React Native SwiftPM
  autolinking share this selection.
- Added downloader `--with-recording` / `--without-recording` options to save
  the app's selection and fetch that variant. Downloads verify SHA-256 before
  replacing an installed payload; previously downloaded variants stay cached.
- Added a repository Yarn install hook to restore missing engine packages
  after branch changes or deleted downloads. Consumer installs continue to
  download prebuilts through `postinstall`, with a manual retry command.
- Aligned both iOS CI build paths with the packaged ARM64 Simulator binaries
  and added engine/bindings slice checks before building.
- Documented silent previews using Godot's `Dummy` audio driver, separately
  from the microphone-free default.

### Migration and platform notes

- Re-export content with Godot 4.7.2, refresh native dependencies and rebuild
  the app. Godot 4.5 binaries and bindings cannot be mixed into this installation.
- iOS devices default to Metal/Mobile. Apps retaining OpenGL should explicitly
  select `opengl3` / `gl_compatibility`; scene lighting and shaders may need
  adjustments when moving between Compatibility and Mobile.
- Microphone capture now requires opt-in, platform permissions and Godot input
  configuration. Playback-only apps need no microphone setting.
- iOS Simulator requires Apple silicon/ARM64 and uses Compatibility. Its
  results do not establish device Metal performance or correctness.
- Android Vulkan has device-dependent embedded background/composition and
  startup issues under investigation. It is an opt-in path; check target GPUs
  and inline/fullscreen transitions before shipping.
- Android embedded input remains touch-only; standalone Godot Android plugins
  and the other input paths listed in the README are not connected.
- First-display cost and offscreen preparation remain dependent on the scene,
  renderer and GPU. This release does not promise faster startup or identical
  output across renderers.

The previous `0.1.0` release uses Godot 4.5.1; its source is retained on
`godot-4.5` for possible focused fixes. See the [upgrade guide](README.md#upgrading-from-45)
and [renderer notes](README.md#choosing-a-renderer) before migrating.

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
