# @preeternal/react-native-godot

[![npm version](https://img.shields.io/npm/v/@preeternal/react-native-godot.svg)](https://www.npmjs.com/package/@preeternal/react-native-godot)
[![npm downloads](https://img.shields.io/npm/dm/@preeternal/react-native-godot.svg)](https://www.npmjs.com/package/@preeternal/react-native-godot)
[![Patreon](https://img.shields.io/endpoint?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%2F%3Fusername%3Dpreeternal%26type%3Dpatrons)](https://www.patreon.com/preeternal)

Bring interactive Godot scenes into your React Native app on Android and iOS.
Build animated 3D previews, product viewers, interactive diagrams or small games
alongside your existing screens and navigation.

Author scenes and animations in Godot, then control them from TypeScript or
JavaScript. React Native handles the app UI; Godot renders inside a native view.

## Features

- Embed the main Godot window and named subwindows in React Native screens.
- Start, stop and restart the engine with different Godot projects.
- Pause and resume a running instance.
- Access Godot objects, methods, properties, signals and Callables from JavaScript.
- Run Godot and its JavaScript worklets on a dedicated thread.
- Choose OpenGL Compatibility, Metal on iOS devices, or Vulkan on Android.
- Use audio playback by default and opt into microphone capture when needed.

## Versions

| Library release                | Godot version | Source branch                                                                  |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------ |
| `0.1.0` — previous release     | 4.5.1         | [`godot-4.5`](https://github.com/Preeternal/react-native-godot/tree/godot-4.5) |
| Upcoming release — this README | 4.7.2         | [`godot-4.7`](https://github.com/Preeternal/react-native-godot/tree/godot-4.7) |

The 4.7 line is the current development focus. The `godot-4.5` branch is kept
for possible fixes to the previous line; backports are considered as needed.
Until the 4.7 library release is published, the npm installation commands below
install `0.1.0`; use the [4.5 README](https://github.com/Preeternal/react-native-godot/blob/godot-4.5/README.md)
for that release. See [Upgrading from 4.5](#upgrading-from-45) for migration notes.

## Compatibility

| Requirement  | Supported configuration                                             |
| ------------ | ------------------------------------------------------------------- |
| React Native | New Architecture                                                    |
| Worklets     | Version satisfying this package's [peer dependencies](package.json) |
| iOS          | 15.0 or newer                                                       |
| Android      | Android 10 / API 29 or newer; `arm64-v8a` and `armeabi-v7a`         |
| Expo         | Development Builds; Expo Go cannot load this native module          |

The library includes a pinned engine; you do not need to build Godot yourself.
This branch uses
[LibGodot `4.7.2.preeternal.2`](https://github.com/Preeternal/libgodot/releases/tag/4.7.2.preeternal.2),
based on Godot 4.7.2. Export your Godot content with a compatible editor.

## Installation

Install the library and its Worklets dependency:

```sh
yarn add @preeternal/react-native-godot react-native-worklets
```

Or with npm:

```sh
npm install @preeternal/react-native-godot react-native-worklets
```

React Native autolinks the native module. Installation downloads the pinned
LibGodot binaries from GitHub and verifies archive checksums. Allow the package's
install script if your package manager requires script approval.

If the automatic download did not run or failed, retry it from your app directory:

```sh
node node_modules/@preeternal/react-native-godot/scripts/download-prebuilt.js
```

This downloads missing engine packages and verifies their checksums. Then retry
your native dependency installation or build.

Add the Worklets plugin last in your application's Babel plugins:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

In an Expo app, keep the `babel-preset-expo` preset.

### iOS: CocoaPods (default)

From your app directory:

```sh
cd ios
bundle exec pod install
cd ..
```

Rebuild the native app after installation.

### iOS: Swift Package Manager (React Native 0.87+)

SwiftPM is an experimental, opt-in alternative to CocoaPods. Every native
dependency, including Worklets, must provide a compatible SwiftPM manifest.

To migrate your app once:

```sh
cd ios
npx react-native spm --deintegrate
```

After a fresh clone or a dependency change, generate the SwiftPM workspace
from your app's `ios` directory:

```sh
npx react-native spm
```

Use React Native's generated workspace; this library's manifest depends on
React Native's generated headers and codegen products.

### Android

In a Community CLI app, set `minSdkVersion` to at least `29` in
`android/build.gradle`:

```groovy
buildscript {
    ext {
        minSdkVersion = 29
    }
}
```

Keep your other existing build settings. Set the supported architectures in
`android/gradle.properties`:

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Use an ARM device or ARM emulator. The bundled engine does not contain x86 or
x86_64 binaries. The library registers its bundled Maven repository automatically.

### Expo Development Builds

Register the config plugin in `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@preeternal/react-native-godot",
        {
          "iosPacks": ["./assets/main.pck"]
        }
      ]
    ]
  }
}
```

`iosPacks` is optional. It lists PCK files to add to the iOS app bundle.
The plugin configures Android's minimum SDK, ARM architectures, Maven repository
and Godot asset retention. Run `npx expo prebuild` after changing this
configuration, then rebuild your Development Build.

## Add your Godot project

Export your Godot project as content (PCK or ZIP), rather than as a standalone
application.

- **Android:** extract the exported ZIP into
  `android/app/src/main/assets/main/`, including its hidden `.godot` directory.
  Start the engine with `--path /main`.
- **iOS:** add `main.pck` to your Xcode app target's Copy Bundle Resources,
  or list it in the Expo plugin's `iosPacks`. Start the engine with
  `--main-pack` and its absolute path in the app bundle.

For unpacked Android exports, preserve hidden Godot resources in your app's
`android/app/build.gradle`:

```groovy
android {
    androidResources {
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~"
    }
}
```

Expo apps receive this setting from the config plugin. Without it, exported
scenes and imported resources under `.godot` may be missing from the APK.

You can also load content from an accessible directory or pack downloaded to
the app's private storage. Pass its path to `createInstance`.

## Usage

The following example uses `MainBundlePath` to locate the iOS pack. Install
this helper if your app does not already have another way to find the bundle:

```sh
yarn add @dr.pogodin/react-native-fs
```

Install its native dependencies before rebuilding on iOS.

```tsx
import { Button, Platform, View } from 'react-native';
import { MainBundlePath } from '@dr.pogodin/react-native-fs';
import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@preeternal/react-native-godot';

function startGodot() {
  const args =
    Platform.OS === 'android'
      ? [
          '--path',
          '/main',
          '--rendering-driver',
          'opengl3',
          '--rendering-method',
          'gl_compatibility',
        ]
      : ['--main-pack', `${MainBundlePath}/main.pck`];
  args.push('--display-driver', 'embedded');

  return runOnGodotThread(() => {
    'worklet';
    if (RTNGodot.getInstance() == null) {
      if (RTNGodot.createInstance(args) == null) {
        throw new Error('Godot failed to start. Check the native logs.');
      }
    }
  });
}

function stopGodot() {
  return runOnGodotThread(() => {
    'worklet';
    RTNGodot.destroyInstance();
  });
}

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <Button
        title="Start"
        onPress={() => {
          startGodot().catch(console.error);
        }}
      />
      <Button
        title="Stop"
        onPress={() => {
          stopGodot().catch(console.error);
        }}
      />
      <RTNGodotView style={{ flex: 1 }} />
    </View>
  );
}
```

Start is explicit. `RTNGodotView` displays the engine's main window when
`windowName` is omitted. Give the view a nonzero size. The `embedded` display
driver is required.

Only one engine instance runs at a time. After stopping it, start a new instance
with the same arguments or a different project. Stop the engine when your app
no longer needs it; removing a view is not a request to destroy the engine.

### Pause and resume

Call these on the main JavaScript thread:

```typescript
RTNGodot.pause();
RTNGodot.resume();
const paused = RTNGodot.is_paused();
```

Pausing keeps the instance alive.
For previews shown across several screens, reuse the instance and pause it
when it is idle instead of loading the project on every navigation. Release
scene references and signal handlers when their consumer goes away.

### Named windows

Create a Godot subwindow with the matching name, then embed it in another view:

```tsx
<RTNGodotView style={{ flex: 1 }} windowName="subwindow" />
```

The [example app](example/README.md) demonstrates this with React Navigation.

## Platform notes

### Choosing a renderer

OpenGL Compatibility is a useful starting point for embedded previews and broad
device coverage. Metal and Vulkan make Godot's Mobile renderer available for
scenes that need its rendering features. Choose for your scene and target
hardware: a newer graphics API does not automatically make a simple preview
faster. See Godot's [renderer comparison](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html).

| Target        | Driver / rendering method      | When to use it                                            |
| ------------- | ------------------------------ | --------------------------------------------------------- |
| Android       | `opengl3` / `gl_compatibility` | Starting point; used by the example                       |
| Android       | `vulkan` / `mobile`            | Optional; validate on your target GPUs                    |
| iPhone/iPad   | `metal` / `mobile`             | Native bridge default when renderer arguments are omitted |
| iPhone/iPad   | `opengl3` / `gl_compatibility` | Explicit Compatibility option                             |
| iOS Simulator | `opengl3` / `gl_compatibility` | Only packaged option; selected automatically              |

Pass the driver and method together in the arguments to `createInstance`,
alongside your content path and `--display-driver embedded`:

```typescript
// OpenGL Compatibility on Android or iOS, including Simulator:
const rendererArgs = [
  '--rendering-driver',
  'opengl3',
  '--rendering-method',
  'gl_compatibility',
];

// Metal / Mobile on a physical iPhone or iPad:
const metalArgs = [
  '--rendering-driver',
  'metal',
  '--rendering-method',
  'mobile',
];

// Vulkan / Mobile on a compatible Android device:
const vulkanArgs = [
  '--rendering-driver',
  'vulkan',
  '--rendering-method',
  'mobile',
];
```

Select the renderer before starting the engine. The bridge does not implement
an automatic retry with a different renderer after startup failure. A
JavaScript error handler cannot recover from a native crash. If you expose a
renderer preference, keep a way to reset it before the next engine startup.

Practical things to check before shipping:

- **Lighting and materials:** Compatibility and Mobile can produce different
  lighting, shadows and shader results. Tune the scene for each renderer you
  offer, especially when matching a 3D background to the surrounding app UI.
- **Android Vulkan:** black background regions, composition artifacts and slow
  first display have been observed on some devices with embedded content.
  Treat Vulkan as an opt-in path and test both inline and fullscreen views;
  the Android version alone does not establish GPU/driver compatibility.
- **First display:** loading a scene and preparing shaders can cost more than
  showing it again. Compare Release builds on real devices, measuring both
  first use and reuse. Creating an instance offscreen does not guarantee that
  every shader has been prepared. See Godot's [shader compilation guidance](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html).
- **Simulator:** the package supports ARM64 on Apple silicon, uses OpenGL and
  contains no Metal backend. Explicit Metal requests are rejected before
  engine creation. Device Metal may perform better, but Simulator frame rates
  and visuals do not predict device results; check the actual device.

### Android input

The embedded Android view currently forwards touch input. Godot's virtual
keyboard, hardware keyboard, mouse, gamepad and sensor input, and standalone
Godot Android plugins are not connected to this embedded path. Use React Native
controls for interactions requiring those features.

## Audio and microphone

**Audio playback is enabled. Microphone capture is excluded from the default
build.** No configuration is needed for projects that only play sound.

Apple can require `NSMicrophoneUsageDescription` when a bundled SDK references
protected microphone APIs, even if your app never records audio. The default
LibGodot build removes capture code and its iOS microphone permission API
references at compile time. Muting audio or disabling input at runtime cannot
remove those references. See Apple's [protected resource requirements](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources).
Other SDKs in your app may still require their own purpose strings.

### Enable microphone capture

Add this top-level setting to **your app's** `package.json`:

```json
{
  "reactNativeGodot": {
    "microphone": true
  }
}
```

Then download the selected binaries from your app directory:

```sh
node node_modules/@preeternal/react-native-godot/scripts/download-prebuilt.js
```

Refresh iOS native dependencies (`bundle exec pod install` in `ios`, or
`npx react-native spm` for SwiftPM), then rebuild the native app. Expo apps use
the same `package.json` setting and also need a new native build.

This selects recording-capable LibGodot `4.7.2.preeternal.1` instead of the
default `4.7.2.preeternal.2`, with matching bindings. Both use Godot 4.7.2.
Set `microphone` to `false` or remove it, then repeat these steps to return to
the default. This is a native build choice; JavaScript reload cannot change it.

Configure `NSMicrophoneUsageDescription` on iOS, `RECORD_AUDIO` and runtime
permission handling on Android, and `audio/driver/enable_input=true` in your
Godot project. Re-export after changing Godot settings. The library does not
request microphone permission for you.

### Silent previews and background music

For visual-only content, select the `Dummy` audio driver in `project.godot`,
then re-export and rebuild your app:

```ini
[audio]

driver/driver="Dummy"
driver/enable_input=false
```

This disables Godot audio output and input, avoiding its use of the platform
audio driver when the preview needs no sound. Setting the master volume to
zero still leaves that driver active. Check music from another app alongside
your app's own audio session settings. See [Godot's audio driver setting](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html#class-projectsettings-property-audio-driver-driver).

## Godot API

Use `runOnGodotThread` for engine calls and scene-tree access. It returns a
Promise, so handle errors in your calling code. Obtain the API inside the
worklet after starting the engine:

```typescript
await runOnGodotThread(() => {
  'worklet';
  if (RTNGodot.getInstance() == null) return;

  const Godot = RTNGodot.API();
  const vector = Godot.Vector2();
  vector.x = 1;
  vector.y = 2;

  const sceneTree = Godot.Engine.get_main_loop();
  if (!sceneTree) return;

  const root = sceneTree.get_root();
  const player = root.find_child('Player', true, false);
  if (player) {
    player.set_position(vector);
  }
});
```

Singletons are properties such as `Godot.Engine`. Constructors, properties
and methods follow the Godot API exposed by the bundled engine.

### Signals

Connect JavaScript functions to Godot signals from a worklet:

```typescript
await runOnGodotThread(() => {
  'worklet';
  if (RTNGodot.getInstance() == null) return;

  const Godot = RTNGodot.API();
  const sceneTree = Godot.Engine.get_main_loop();
  if (!sceneTree) return;

  const button = sceneTree.get_root().find_child('Button', true, false);
  if (button) {
    button.pressed.connect(function () {
      console.log('Button pressed');
    });
  }
});
```

Callbacks execute in the Godot runtime. Disconnect signal handlers when your
application no longer needs them.

### Callables

Godot methods accepting a `Callable` can receive JavaScript functions.
For example, attach this GDScript to a node named `RNInterface`:

```gdscript
extends Node

func test_callable(callback: Callable) -> void:
    callback.call("Hello from Godot")
```

Call it from the Godot thread:

```typescript
await runOnGodotThread(() => {
  'worklet';
  if (RTNGodot.getInstance() == null) return;

  const sceneTree = RTNGodot.API().Engine.get_main_loop();
  if (!sceneTree) return;

  const node = sceneTree.get_root().find_child('RNInterface', true, false);
  if (node) {
    node.test_callable(function (message: string) {
      console.log(message);
    });
  }
});
```

### Threading and object lifetime

Godot runs on a thread separate from the native UI and React Native JavaScript
threads. `runOnGodotThread` schedules a Worklets function on that thread.

Godot object references belong to the JavaScript runtime where they were
obtained. Keep API access and object manipulation inside Godot worklets; do not
pass Godot objects between the main JavaScript runtime and the Godot runtime.
After `destroyInstance`, discard references to the previous instance's objects.

## Upgrading from 4.5

The 4.7 line keeps the `RTNGodot`, `RTNGodotView` and `runOnGodotThread` entry
points. Upgrade the library, its native engine packages and your exported Godot
content together:

1. Re-export PCK/ZIP content with Godot 4.7.2. Include the re-exported `.godot`
   resources on Android; replace bundled packs and version any downloaded
   content caches so an old export is not reused accidentally.
2. Refresh native dependencies and rebuild the app. The library installs its
   matching engine and bindings automatically; keep custom 4.5 binaries out
   of a 4.7 installation. A JavaScript reload is insufficient.
3. Review renderer arguments. An iOS device now defaults to Metal/Mobile;
   choose `opengl3` / `gl_compatibility` explicitly to retain Compatibility.
   Check lighting, shaders and the first visible frame on real devices.
4. If your app records audio, [enable microphone capture](#enable-microphone-capture)
   and configure permissions. Playback-only apps can use the default build.
5. Check Start → Stop → Start, pause/resume, navigation, resize and any named
   windows used by your app. Drop old Godot object references after Stop.

For an app staying on 4.5, keep its library release and exported content
together. The `godot-4.5` branch remains separate from the 4.7 line.
See the [release notes](CHANGELOG.md) for the changes in this migration.

## Examples

See the [example app and its setup instructions](example/README.md) for two
Godot projects, lifecycle controls and a named subwindow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, checks,
custom engine builds, debugging and release tooling.

Issues and pull requests are welcome in the
[GitHub repository](https://github.com/Preeternal/react-native-godot).
See the [code of conduct](CODE_OF_CONDUCT.md).

## Upstream / credits

This maintained fork builds on the native bridge, platform integration and
LibGodot integration developed by [Migeran](https://migeran.com).
[Born](https://born.com) deserves credit for the original
[React Native adaptation](https://github.com/borndotcom/react-native-godot)
and early product integration.

The fork adds the Godot 4.7 integration, renderer selection, native lifecycle
and surface handling fixes, and installation tooling described in the
[release notes](CHANGELOG.md). It is used in an actively developed app;
maintenance follows practical integration needs and available time.

## License

MIT. See [LICENSE](LICENSE) for details.

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob).
