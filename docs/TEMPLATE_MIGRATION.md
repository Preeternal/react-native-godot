# Template migration

The migration uses the two `create-react-native-library` **0.64.0** projects
generated for the existing module and view names: `NativeGodotModule`
(TurboModule, Kotlin/Objective-C) and `RTNGodotView` (Fabric view).

## Template components

| Area | Files / configuration |
| --- | --- |
| Package and build | `package.json` exports, Bob ESM/types targets, `src`, `cpp`, `tsconfig*.json`, `babel.config.mjs` |
| Commit hooks | Lefthook, commitlint CLI and Conventional Commits configuration |
| Release tooling | release-it and its conventional-changelog plugin configuration |
| Lint and formatting | Flat ESLint config, Prettier configuration in `package.json`, `.editorconfig` |
| Development versions | `.nvmrc`, `.tool-versions`, Corepack `packageManager`, Yarn workspaces |
| Repository files | `.gitattributes`, `.gitignore`, `.watchmanconfig` |
| CI | Shared dependency setup, lint/typechecks, tests, package build and Android/iOS builds; `turbo.json` |
| Example JS | CLI entrypoint, workspace dependency, Metro, Bob Babel config and TypeScript |
| Example Android | Gradle wrapper/settings, RN app Gradle config, Kotlin app entrypoints, manifest and resources |
| Example iOS | Podfile, Swift app/scene delegates, Xcode project, scheme, launch screen and privacy resources |
| Community | Contributor workflow and bug report form |

## Deliberate adaptations

- `@commitlint/cli` provides the same `commitlint` executable as the template's
  convenience package. The CLI dependency was already selected locally; its
  Conventional Commits config and hook are preserved.
- Both the TurboModule and Fabric view share one package and `codegenConfig`
  with `type: all`. The public names remain `NativeGodotModule` and
  `RTNGodotView`; generated template suffixes such as `RTNGodotViewView` are
  not part of the API.
- Godot's existing C++/JNI implementation, lifecycle and embedding logic are
  preserved. Android wrappers are Kotlin. The iOS library keeps Objective-C++
  for direct C++ integration; its example uses Swift app entrypoints.
- The empty `multiply`/color demos and `it.todo` test are replaced by the two
  Godot demos and real Expo plugin tests. Root and example typechecks are
  separate, and both run in the commit hook and CI.
- The example adds React Navigation native stack, Worklets and
  `@dr.pogodin/react-native-fs`. It has no Expo runtime or portal dependency.
  The library retains its Expo config plugin for consuming apps.
- Android needs API 29 and ARM ABIs. Unpacked Godot exports require the
  `.godot` asset setting. These are additions to the stock native template.
- LibGodot download/checksum tooling, Maven/prefab integration and binary
  dependencies are retained. Native CI uses JDK 21 for this Gradle toolchain.
  CI also restores LFS example assets and ensures prebuilts exist after a
  dependency-cache restore.
- SwiftPM is an additional integration, modeled after the file-hash and
  cookie-manager manifests. It explicitly depends on RNWorklets; its package
  graph has been checked, but a full native SwiftPM build remains unverified.
- Yarn is pinned through Corepack instead of checking in the template's Yarn
  executable. `.tool-versions` and `.nvmrc` use the same Node version.
- The upstream MIT notice is retained with an additional notice for the fork.
  Template community-policy boilerplate with an unset contact placeholder is
  not adopted. GitHub issue creation remains open for reports and requests.
- The old Python pre-commit configuration is removed: it referenced the
  deleted `.prettierrc`. Lefthook is the active hook manager.
