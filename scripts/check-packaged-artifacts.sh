#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [path-to-tarball]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  TARBALL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
else
  cd "$ROOT_DIR"
  NPM_CONFIG_CACHE="$TMP_DIR/npm-cache" \
    npm pack --silent --ignore-scripts \
    --pack-destination "$TMP_DIR" >/dev/null
  TARBALL="$(find "$TMP_DIR" -maxdepth 1 -type f \
    -name '*.tgz' -print -quit)"
fi

cd "$ROOT_DIR"

if [[ ! -f "$TARBALL" ]]; then
  echo "Tarball not found: $TARBALL" >&2
  exit 1
fi

CONTENTS_FILE="$TMP_DIR/tar-contents.txt"
tar -tzf "$TARBALL" > "$CONTENTS_FILE"

required_paths=(
  package/package.json
  package/app.plugin.js
  package/Package.swift
  package/react-native-godot.podspec
  package/react-native.config.js
  package/prebuilt-utils.rb
  package/scripts/download-prebuilt.js
  package/src/index.tsx
  package/lib/module/index.js
  package/lib/typescript/src/index.d.ts
  package/android/build.gradle
  package/android/src/main/AndroidManifest.xml
  package/android/src/main/cpp/CMakeLists.txt
  package/ios/GodotModule.mm
  package/cpp/NativeGodotModule.cpp
)

missing=()
for path in "${required_paths[@]}"; do
  if ! grep -Fxq "$path" "$CONTENTS_FILE"; then
    missing+=("$path")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Packaged tarball is missing required artifacts:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

forbidden_patterns=(
  '^package/(android|ios)/build/'
  '^package/(android|ios)/libs/'
  '^package/(android|ios)/local\.properties$'
  '^package/(example|node_modules)/'
  '^package/\.build/'
  '(^|/)\.DS_Store$'
)

for pattern in "${forbidden_patterns[@]}"; do
  if grep -Eq "$pattern" "$CONTENTS_FILE"; then
    echo "Packaged tarball contains forbidden content matching: $pattern" >&2
    grep -E "$pattern" "$CONTENTS_FILE" | sed 's/^/  - /' >&2
    exit 1
  fi
done

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
const entries = packageJson.prebuiltFiles ?? [];
const errors = [];
const names = new Set();

for (const entry of entries) {
  for (const field of [
    'name',
    'filename',
    'version',
    'base_url',
    'shasum',
    'destination_base_dir',
    'env',
  ]) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      errors.push(`${field} is missing for prebuilt entry`);
    }
  }

  if (names.has(entry.name)) {
    errors.push(`duplicate prebuilt name: ${entry.name}`);
  }
  names.add(entry.name);

  if (
    entry.base_url !==
    'https://github.com/Preeternal/libgodot/releases/download/'
  ) {
    errors.push(`unexpected base_url for ${entry.name}: ${entry.base_url}`);
  }
  if (!/^[0-9a-f]{64}$/i.test(entry.shasum)) {
    errors.push(`invalid SHA-256 for ${entry.name}`);
  }
  if (entry.no_unpack !== 'false') {
    errors.push(`${entry.name} must be unpacked by the installer`);
  }

  const target = path.join(
    root,
    entry.destination_base_dir,
    entry.name,
    entry.version
  );
  if (!fs.existsSync(target) || fs.readdirSync(target).length === 0) {
    errors.push(`prebuilt directory is missing or empty: ${target}`);
  }
}

if (entries.length !== 4) {
  errors.push(`expected 4 prebuilt entries, found ${entries.length}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Verified ${entries.length} prebuilt metadata entries and directories`);
NODE

echo "Verified packaged artifacts in: $TARBALL"
