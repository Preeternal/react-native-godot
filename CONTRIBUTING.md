# Contributing

## Development workflow

This repository uses the `create-react-native-library` 0.64.0 layout with a
Yarn workspace for the Community CLI example. Use the Node version in `.nvmrc`
and the Yarn version pinned by `packageManager` in `package.json` (Corepack).
ASDF users can install the Node, Java and Ruby versions in `.tool-versions`
with `asdf install`.

From the repository root:

```sh
corepack enable
yarn install
```

Installation downloads the pinned LibGodot prebuilts. The repository's Yarn
plugin also checks their directories after every install, including after a
branch switch or deletion of downloaded files. Existing nonempty directories
for the selected versions are reused. The hook respects
`--mode=skip-build` and `--mode=update-lockfile`; those modes do not fetch
missing binaries. The published package uses its `postinstall` script.

For the example's resource export, native dependencies, Metro, device builds
and IDE setup, follow [the example README](example/README.md).

### Checks

Both iOS CI jobs build the ARM64 Simulator target. The installed LibGodot engine
does not include an x86_64 Simulator slice, so a generic universal Simulator
build is unsupported. `scripts/ci/verify-ios-simulator.py` checks both framework
manifests and binary architectures before native builds. Keep the example's
`build:ios` architecture and the SwiftPM job's `ARCHS` setting consistent.

```sh
yarn typecheck
yarn example typecheck
yarn lint
yarn test
yarn prepare
yarn pack --dry-run
```

`yarn lint` checks the library, example and JavaScript tooling. `yarn test`
runs the tooling tests with Node's test runner, followed by Jest.
The Yarn install tests use isolated temporary workspaces and a stub downloader.

Lefthook runs linting and both TypeScript checks before a commit.
Its `commit-msg` hook enforces Conventional Commits, for example:

```text
fix: preserve exported Godot assets on Android
```

### Native integration

The library combines a TurboModule and a Fabric view. The iOS implementation
initializes Fabric's `_props` with generated `RTNGodotViewProps` defaults
before the first prop update. Keep the bridge, generated bindings and
LibGodot headers compatible when changing native code.

The embedded Android bridge constructs file, directory, networking and IO
services directly. It does not use the removed `IGodotLib` interface or call
`Godot.initEngine()`, which initializes the standalone Android engine.
`RTNGodotIO` implements the method descriptors expected by
`GodotIOJavaWrapper`; keep those methods in the consumer R8 rules.
Touch events carry their window name and are queued on the Godot thread.
UI callbacks must not dereference engine bindings. Capture the instance and
attachment generations when scheduling work; resolve engine objects on the
Godot thread and discard work from a previous instance or attachment.
Android resize requests are coalesced and applied asynchronously. Named-surface
detach still waits for the Godot thread before releasing the native window.
Keep both the requested and the engine-attached window references alive until
replacement or detach completes.
The legacy `addHostPlugin` entry point rejects standalone Android plugins
explicitly; integrating them requires an embedded-compatible engine API.

On iOS, `AppleRendererPolicy.h` resolves omitted renderer arguments before
engine creation using the native `TARGET_OS_SIMULATOR` value. Device defaults
are Metal/Mobile; Simulator defaults are OpenGL3/Compatibility. Explicit options
are preserved, and Simulator Metal is rejected before calling LibGodot. The
policy tests use compile-time assertions with `-fsyntax-only`, without building
or running a native app. Compiled slice evidence does not establish runtime
correctness or performance.

iOS window subscriptions belong to individual host handles. Several hosts can
subscribe to the same window without replacing each other's callbacks. Only
the current main-layer host may resize it or emit readiness. Remove the view's
retained layer on Stop, even after the engine has cleared its layer pointer.
The preferred host survives Stop/Start; old resize and input work cannot take
ownership from a new attachment. `onSurfaceReady` acknowledges host resize work,
not completion of a visible GPU presentation.

The Worklets patch in `.yarn/patches` handles RTTI for the custom Godot queue
across shared-library boundaries. Keep it in place when testing this workspace.

See [the template migration notes](docs/TEMPLATE_MIGRATION.md) for the files
checked against the empty templates and the Godot-specific differences.

## Prebuilt engine packages

The `prebuiltFiles` entries in `package.json` select the release archives,
SHA-256 checksums and destination directories. iOS archives are unpacked under
`ios/libs`; Android archives are unpacked under `android/libs`.

The release tag selects the archive directory. The Android `maven_version`
selects the Maven coordinate declared by the archive's POM; these versions
can differ. Check the POM when changing engine packages rather than deriving
the Maven coordinate from the release tag.

To invoke the downloader directly from the repository root:

```sh
yarn download-prebuilt
```

The downloader requires `curl` and `unzip`. A missing download or checksum
failure must be resolved before attempting a native build.

### Using a custom LibGodot build

Clone LibGodot with its submodules, selecting an engine revision compatible
with this bridge:

```sh
git clone --recursive https://github.com/Preeternal/libgodot
cd libgodot
./build_prebuilt_release.sh
```

Use `./build_prebuilt_dev.sh` for development libraries. Check LibGodot's
build instructions and the selected script's platform targets before starting
a build. Archives are produced under `build/prebuilt/release` or
`build/prebuilt/dev`.

From the React Native Godot repository root, point the downloader at the
archives. Replace `/path/to/libgodot` with your checkout:

```sh
export LIBGODOT_XCFRAMEWORK_PATH=/path/to/libgodot/build/prebuilt/release/libgodot.xcframework.zip
export LIBGODOT_CPP_XCFRAMEWORK_PATH=/path/to/libgodot/build/prebuilt/release/libgodot-cpp.xcframework.zip
export LIBGODOT_ANDROID_PATH=/path/to/libgodot/build/prebuilt/release/libgodot-android.zip
export LIBGODOT_CPP_ANDROID_PATH=/path/to/libgodot/build/prebuilt/release/godot-cpp-android.zip
export SHASUM_CHECK=false
export REPLACE_EXISTING=true
yarn download-prebuilt
```

Use the corresponding `dev` directory for a development build.
The path variables substitute local archives for the configured downloads.
`SHASUM_CHECK=false` bypasses release checksums for these custom archives;
`REPLACE_EXISTING=true` replaces installed copies. Unset the overrides after
the custom install to restore the default download configuration:

```sh
unset LIBGODOT_XCFRAMEWORK_PATH LIBGODOT_CPP_XCFRAMEWORK_PATH
unset LIBGODOT_ANDROID_PATH LIBGODOT_CPP_ANDROID_PATH
unset SHASUM_CHECK REPLACE_EXISTING
```

To restore pinned binaries, run `REPLACE_EXISTING=true yarn download-prebuilt`.
SwiftPM binary targets use their own URLs and checksums in `Package.swift`;
the downloader overrides apply to the CocoaPods and Android paths.

For a development Android archive, inspect its POM and update the artifact
selection in `android/build.gradle` to match. For archives providing
`godot-debug`, the dependency is:

```groovy
api "com.migeran.libgodot:godot-debug:${libGodotMavenVersion}"
```

Update `prebuiltFiles[].maven_version` if the custom POM uses a different
version. Do not change dependency pins or replace release checksums merely to
hide an incompatible archive.

## Debugging native Godot code

Build and install a development LibGodot package as described above.
On iOS, open the app's workspace in Xcode and set breakpoints in the Godot
sources. Depending on Xcode, you may need to open source files separately and
move their editor tabs into the app's workspace.

On Android:

1. In the Android Studio Run/Debug configuration, add the symbol directory
   containing the development `libgodot_android.so`. One possible location
   is `libgodot/godot/platform/android/java/lib/libs/dev/arm64-v8a`.
2. If Android Studio cannot locate Godot sources, add a source-tree symlink:

   ```sh
   cd /path/to/your/app/node_modules/@preeternal/react-native-godot/android/src/main/cpp
   ln -s /path/to/libgodot/godot godot
   ```

3. Resync the Gradle project and launch the app with the debugger.

## Debugging Godot projects in the editor

Use a development LibGodot build for remote debugging.

### Android

1. Add these arguments to `RTNGodot.createInstance`:

   ```json
   ["--remote-debug", "tcp://127.0.0.1:6007"]
   ```

2. Forward the device connection to your computer:

   ```sh
   adb reverse tcp:6007 tcp:6007
   ```

   Repeat this after disconnecting and reconnecting the device.

3. Open the project in the Godot Editor and enable **Debug → Keep Debug Server Open**.
4. Set breakpoints and launch the app from Android Studio.

### iOS

1. In the Godot Editor, open **Editor Settings → Network → Debug → Remote Host**
   and enter your Mac's IP address.
2. Enable **Debug → Keep Debug Server Open**.
3. Add these arguments to `RTNGodot.createInstance`, replacing the address:

   ```json
   ["--remote-debug", "tcp://<your_macs_ip_address>:6007"]
   ```

4. Set breakpoints and launch the app from Xcode. Your Mac and device must
   be able to reach each other on the same network.

## Sending a pull request

Describe the problem, the resulting behavior and the checks you ran.
For native changes, include the platform, engine package version and device
or simulator used. Report unavailable runtime checks explicitly.

Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Release tooling

`yarn release` uses the release-it configuration in `package.json`.
The configuration can create commits and tags, publish to npm and create a
GitHub release. Run it only as part of an intended release.

Before releasing an engine update, verify archive checksums, Android Maven
coordinates, SwiftPM binary targets and the packaged files together.
The npm package excludes downloaded engine binaries; installation retrieves
the pinned archives.
