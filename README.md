# @preeternal/react-native-godot

[![npm version](https://img.shields.io/npm/v/@preeternal/react-native-godot.svg)](https://www.npmjs.com/package/@preeternal/react-native-godot)
[![npm downloads](https://img.shields.io/npm/dm/@preeternal/react-native-godot.svg)](https://www.npmjs.com/package/@preeternal/react-native-godot)
[![Patreon](https://img.shields.io/endpoint?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%2F%3Fusername%3Dpreeternal%26type%3Dpatrons)](https://www.patreon.com/preeternal)

Embed Godot in React Native apps on Android and iOS. Display Godot windows
inside React Native views, control the engine lifecycle, and call Godot APIs
from TypeScript or JavaScript.

## Upstream / credits

This is a maintained fork of the original React Native Godot integration.
The native bridge, platform integration and LibGodot integration were developed
and maintained by [Migeran](https://migeran.com).

[Born](https://born.com) deserves credit for the original
[React Native adaptation](https://github.com/borndotcom/react-native-godot)
and early product integration.

This fork is used in my own project. Maintenance and support depend on my needs
and available time.

## Features

- Embed the main Godot window and named subwindows in React Native screens.
- Start, stop and restart the engine with different Godot projects.
- Pause and resume a running instance.
- Access Godot objects, methods, properties, signals and Callables from JavaScript.
- Run Godot and its JavaScript worklets on a dedicated thread.

## Compatibility

| Requirement  | Supported configuration                                             |
| ------------ | ------------------------------------------------------------------- |
| React Native | New Architecture                                                    |
| Worklets     | Version satisfying this package's [peer dependencies](package.json) |
| iOS          | 15.0 or newer                                                       |
| Android      | Android 10 / API 29 or newer; `arm64-v8a` and `armeabi-v7a`         |
| Expo         | Development Builds; Expo Go cannot load this native module          |

The engine version is pinned by the installed library. This source branch uses
[LibGodot `4.7.2.preeternal.1-rc.4`](https://github.com/Preeternal/libgodot/releases/tag/4.7.2.preeternal.1-rc.4),
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
      RTNGodot.createInstance(args);
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

### Named windows

Create a Godot subwindow with the matching name, then embed it in another view:

```tsx
<RTNGodotView style={{ flex: 1 }} windowName="subwindow" />
```

The [example app](example/README.md) demonstrates this with React Navigation.

## Platform notes

### iOS renderer policy

The native bridge selects these defaults before creating the engine instance:

| Target             | Rendering driver        | Rendering method   | Native layer   |
| ------------------ | ----------------------- | ------------------ | -------------- |
| iPhone/iPad device | `metal`                 | `mobile`           | `CAMetalLayer` |
| iOS Simulator      | `opengl3` (OpenGL ES 3) | `gl_compatibility` | `CAEAGLLayer`  |

The Simulator package is built with `metal=no`. Leave the renderer arguments
unset to use the target's defaults, or supply an explicit supported pair.
An explicit Metal request in Simulator fails before engine creation. Startup
failure does not automatically retry with another renderer.

Device Metal can perform better than the Simulator preview, but speed depends
on the scene and hardware. Benchmark on the target device: Simulator uses a
different renderer and GPU environment, so its frame rate does not predict
device performance. Materials, shaders and lighting can also differ between
Mobile and Compatibility. Simulator results do not verify device Metal.

### Android input

The embedded Android view currently forwards touch input. Godot's virtual
keyboard, hardware keyboard, mouse, gamepad and sensor input, and standalone
Godot Android plugins are not connected to this embedded path. Use React Native
controls for interactions requiring those features.

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

## Examples

See the [example app and its setup instructions](example/README.md) for two
Godot projects, lifecycle controls and a named subwindow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, checks,
custom engine builds, debugging and release tooling.

Issues and pull requests are welcome in the
[GitHub repository](https://github.com/Preeternal/react-native-godot).
See the [code of conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE) for details.

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob).
