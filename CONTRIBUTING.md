# Contributing

This repository uses the `create-react-native-library` 0.64.0 layout with a
Yarn workspace for the Community CLI example. Use the Node version in `.nvmrc`
and the Yarn version pinned by `packageManager` in `package.json` (Corepack).
ASDF users can use `.tool-versions` instead.

```sh
corepack enable
yarn install
```

Installation downloads the pinned LibGodot prebuilts and installs Lefthook.
Export the two Godot example projects as described in the README before a
native build if their exported resources are absent.

```sh
yarn typecheck
yarn example typecheck
yarn lint
yarn test
yarn prepare
yarn pack --dry-run
```

`yarn lint` checks the library, example and JavaScript tooling. `yarn test`
runs the Expo plugin tests with Node's test runner, followed by Jest. Jest is
configured for React Native tests; no placeholder test is copied from the
empty templates.

Run `yarn example start` in one terminal, then `yarn example android` or
`yarn example ios` in another. Stop Metro when finished. Native changes require
rebuilding the app. Open `example/android` in Android Studio or
`example/ios/RTNGodotViewExample.xcworkspace` in Xcode. CocoaPods is the default
iOS integration; the SwiftPM path is described separately in the README.

Lefthook runs linting and both TypeScript checks before a commit. Its
`commit-msg` hook enforces Conventional Commits, for example:

```text
fix: preserve exported Godot assets on Android
```

`yarn release` uses the template's release-it configuration and can create
tags, publish to npm and create a GitHub release. Only run it when a release
is intended; this repository is still preparing its first npm release.

See [the template migration notes](docs/TEMPLATE_MIGRATION.md) for the files
checked against the two empty templates and the Godot-specific differences.
