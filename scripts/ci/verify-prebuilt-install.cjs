#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(process.argv[2] ?? process.cwd());
const packageJsonPath = path.join(packageRoot, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  throw new Error(`Package manifest not found: ${packageJsonPath}`);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const missing = [];

for (const entry of packageJson.prebuiltFiles ?? []) {
  const target = path.join(
    packageRoot,
    entry.destination_base_dir,
    entry.name,
    entry.version
  );

  if (!fs.existsSync(target) || fs.readdirSync(target).length === 0) {
    missing.push(target);
  }
}

if (missing.length > 0) {
  console.error('Missing or empty prebuilt directories:');
  for (const target of missing) {
    console.error(`- ${target}`);
  }
  process.exit(1);
}

console.log(
  `Verified ${packageJson.prebuiltFiles.length} prebuilt directories in ${packageRoot}`
);
