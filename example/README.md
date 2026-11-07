# React Native Godot example

This example uses the React Native Community CLI template with React Native
`0.88.0` and React `19.3.0`. It demonstrates two Godot projects, engine lifecycle
controls, and a named subwindow opened through React Navigation native stack.

The main implementation is in [`src/App.tsx`](src/App.tsx). Use Start 1 or
Start 2 to launch a Godot project, and Stop to shut down the engine.
On iOS, `@dr.pogodin/react-native-fs` locates the bundled PCK files. Android
loads the exported resources from `android/app/src/main/assets`.

## Startup and renderers

The native iOS bridge selects the renderer before creating the instance:
Metal/Mobile on a physical iPhone or iPad, OpenGL ES 3/Compatibility in
Simulator. Android uses OpenGL compatibility. The example does not force
Metal for every iOS target or retry with another renderer after a failure.

Initialization errors show an alert. A native process crash cannot be caught
by this alert. Simulator results do not verify device Metal or predict its
performance; benchmark and check visual differences on a physical device.

## Prerequisites

Use the Node version in the repository's `.nvmrc` and the Yarn version pinned
in `package.json`. Install the React Native Android or iOS toolchain for your
platform. ASDF users can run `asdf install` from the repository root to use
the versions in `.tool-versions`.

Android requires API 29 or newer and an ARM device or ARM emulator. iOS
requires version 15 or newer. Use a Godot editor compatible with the engine
version selected in the library's `package.json`.

## Install dependencies

From the repository root:

```sh
corepack enable
yarn install
```

Installation downloads and checksum-verifies the selected engine archives.
Every repository `yarn install` also restores missing prebuilt directories,
including after a branch switch. Existing copies of the selected version are
reused. No separate engine download command is required for normal setup.

## Export Godot resources

From the `example` directory:

```sh
./export_godot_GodotTest.sh ios
./export_godot_GodotTest2.sh ios
./export_godot_GodotTest.sh android
./export_godot_GodotTest2.sh android
```

Set `GODOT_EDITOR` to the editor executable if it is installed at a custom
location. Export resources with an editor compatible with your runtime.

The scripts look for `/Applications/Godot.app/Contents/MacOS/Godot` by
default. For a different installation, set the executable before exporting:

```sh
export GODOT_EDITOR=/path/to/godot_editor
```

Android exports are unpacked into `android/app/src/main/assets`; iOS exports
are PCK files under `ios`. Re-export after changing a Godot project.

The shared `export_godot.sh` helper accepts these options:

| Option       | Meaning                                     |
| ------------ | ------------------------------------------- |
| `--target`   | Base directory for platform-specific output |
| `--project`  | Godot project directory                     |
| `--name`     | Exported pack or directory name             |
| `--preset`   | Godot export preset                         |
| `--platform` | `ios` or `android`                          |

## Install iOS native dependencies

From the repository root, before the first iOS build and after changing native
dependencies:

```sh
cd example/ios
bundle install
bundle exec pod install
```

## Run

From the repository root:

```sh
yarn example start
```

Keep Metro running. In a separate terminal, from the repository root, run
the command for your platform:

```sh
yarn example ios
# Or:
yarn example android
```

The root aliases `yarn ios` and `yarn android` run the same example commands.
Native changes require rebuilding the app. Press Start 1 or Start 2 after
launching; the example does not start the engine automatically.

Open these projects when using native IDEs:

- Xcode: `example/ios/RTNGodotViewExample.xcworkspace`.
- Android Studio: `example/android`.

If ASDF-managed tools are unavailable in Android Studio, launch it from the
repository root:

```sh
open -a "Android Studio"
```

Stop Metro when finished. For custom engine packages and native debugging,
see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Check TypeScript

From the repository root:

```sh
yarn example typecheck
```

The native projects, Metro configuration, codegen integration, and build
commands follow the Community CLI template.
