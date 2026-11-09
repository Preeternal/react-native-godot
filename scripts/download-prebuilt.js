#!/usr/bin/env node

/**
 * Script to download pre‑built Godot zip files defined in the library's package.json.
 *
 * Usage (from the example project):
 *   yarn download-prebuilt
 *
 * The script:
 * 1. Reads the `prebuiltFiles` array from @preeternal/react-native-godot's package.json.
 * 2. For each entry it builds a download URL: `${base_url}${version}/${filename}`.
 * 3. If an environment variable named in the entry's `env` key is set and non‑empty,
 *    its value is treated as a path to a local archive file. The file is copied into
 *    the temporary folder and processed as if it had been downloaded.
 * 4. Otherwise the file is downloaded from the network to a temporary location.
 *    **Redirects (301, 302, 303, 307, 308) are now followed automatically via `curl -L`.**
 * 5. Verifies the SHA‑256 checksum against `shasum` unless the environment variable
 *    SHASUM_CHECK is set to "false".
 * 6. If the checksum matches (or verification is skipped), extracts the zip into
 *    `${destination_base_dir}/${name}/${version}` (creating directories as needed).
 *
 * Additional behaviour:
 * - If the target extraction folder (`destination_base_dir/name/version`) already
 *   exists and is not empty, the script skips processing that entry.
 * - The app's reactNativeGodot.microphone selects one complete release set.
 * - --with-recording / --without-recording save that choice in the app package.json.
 * - Previously installed versions are preserved when switching variants.
 *
 * NOTE:
 * The `destination_base_dir` values in package.json are now interpreted as
 * relative to the **parent folder of this script** (i.e. the repository root),
 * not relative to the current working directory from which the script is invoked.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execFile } = require('child_process');
const {
  resolvePrebuiltConfig,
  setMicrophone,
  parseArguments,
} = require('./prebuilt-config');

// Resolve the library's package.json (the script lives in ./scripts/)
const libPackagePath = path.resolve(__dirname, '..', 'package.json');
if (!fs.existsSync(libPackagePath)) {
  console.error('Unable to locate package.json of the library.');
  process.exit(1);
}
const libPackage = JSON.parse(fs.readFileSync(libPackagePath, 'utf8'));

if (
  !Array.isArray(libPackage.prebuiltFiles) ||
  libPackage.prebuiltFiles.length === 0
) {
  console.log('No prebuilt files defined in package.json.');
  process.exit(0);
}

/**
 * Download a file from `url` and write it to `destPath`.
 * Uses the external `curl` command with `-L` to follow redirects.
 *
 * @param {string} url - The URL to download.
 * @param {string} destPath - Destination file path.
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // Ensure any previous partial file is removed
    if (fs.existsSync(destPath)) {
      try {
        fs.unlinkSync(destPath);
      } catch {
        // ignore
      }
    }

    execFile('curl', ['-fL', '-o', destPath, url], (error) => {
      if (error) {
        // Clean up partial download
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch {
            // ignore
          }
        }
        reject(new Error(`curl failed for ${url}: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Compute SHA‑256 hash of a file.
 */
function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Extract a zip file using the system `unzip` command.
 */
function unzipFile(zipPath, targetDir) {
  try {
    execFileSync('unzip', ['-qo', zipPath, '-d', targetDir], {
      stdio: 'inherit',
    });
  } catch (err) {
    throw new Error(`Failed to unzip ${zipPath}: ${err.message}`);
  }
}

/**
 * Helper: check whether a directory exists and is non‑empty.
 */
function isNonEmptyDirectory(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) return false;
    const entries = fs.readdirSync(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolve a path that is relative to the repository root (the parent folder of this script).
 */
function resolveRepoRelative(relativePath) {
  const repoRoot = path.resolve(__dirname, '..'); // parent of ./scripts/
  return path.join(repoRoot, relativePath);
}

/**
 * Main processing loop.
 */
(async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.microphone !== undefined) {
    setMicrophone(options.appRoot, options.microphone);
  }
  const selection = resolvePrebuiltConfig(options.appRoot);
  console.log(
    `LibGodot microphone: ${selection.microphone ? 'enabled (.1)' : 'excluded (.2)'}`
  );
  // Determine whether checksum verification should be performed.
  const skipChecksum =
    process.env.SHASUM_CHECK &&
    process.env.SHASUM_CHECK.toLowerCase() === 'false';

  const replaceExisting =
    process.env.REPLACE_EXISTING &&
    process.env.REPLACE_EXISTING.toLowerCase() === 'true';

  for (const entry of selection.prebuiltFiles) {
    const {
      name,
      filename,
      version,
      base_url,
      shasum,
      destination_base_dir,
      env,
      no_unpack,
    } = entry;

    // Build URL – use the `filename` field for the actual archive name.
    const url = `${base_url}${version}/${filename}`;
    console.log(`\nProcessing ${name} (version ${version})`);
    console.log(`Downloading from: ${url}`);
    const need_unzip = no_unpack.toLowerCase() === 'false';

    // Resolve destination directories relative to the repository root.
    const destBaseFull = resolveRepoRelative(destination_base_dir);
    const extractDir = path.join(destBaseFull, name, version);

    // -----------------------------------------------------------------
    // Skip logic: if target folder exists and is non‑empty, skip entry.
    // -----------------------------------------------------------------
    if (isNonEmptyDirectory(extractDir)) {
      if (!replaceExisting) {
        console.log(
          `Target directory ${extractDir} already exists and is not empty. Skipping this entry.`
        );
        continue; // move to next prebuilt file
      }
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtngodot-prebuilt-'));
    const tmpPath = path.join(tmpDir, filename);

    try {
      // -------------------------------------------------------------
      // 1️⃣ If an environment variable is provided, use the local file.
      // -------------------------------------------------------------
      if (env && process.env[env] && process.env[env].trim() !== '') {
        const localFilePath = process.env[env];
        console.log(
          `Environment variable ${env} is set. Using local archive: ${localFilePath}`
        );

        if (!fs.existsSync(localFilePath)) {
          throw new Error(
            `Local file specified by ${env} does not exist: ${localFilePath}`
          );
        }

        // Copy the local archive into the temporary location so that the rest
        // of the workflow (checksum, unzip) works unchanged.
        fs.copyFileSync(localFilePath, tmpPath);
        console.log('Copied local archive to temporary location.');
      } else {
        // -------------------------------------------------------------
        // 2️⃣ No env var – download from the network (using curl).
        // -------------------------------------------------------------
        await downloadFile(url, tmpPath);
        console.log('Download completed.');
      }

      // -------------------------------------------------------------
      // 3️⃣ Verify checksum (unless disabled)
      // -------------------------------------------------------------
      if (!skipChecksum) {
        const actualHash = await computeSha256(tmpPath);
        if (actualHash !== shasum.toLowerCase()) {
          throw new Error(
            `Checksum mismatch for ${name}. Expected ${shasum}, got ${actualHash}`
          );
        }
        console.log('Checksum verified.');
      } else {
        console.log(
          'Skipping checksum verification because SHASUM_CHECK is set to false.'
        );
      }

      // -------------------------------------------------------------
      // 4️⃣ Extract
      // -------------------------------------------------------------
      const stagedDir = path.join(tmpDir, 'extracted');
      fs.mkdirSync(stagedDir);
      console.log(`Extracting to ${extractDir}`);
      if (need_unzip) {
        unzipFile(tmpPath, stagedDir);
      } else {
        const copyPath = path.join(stagedDir, filename);
        fs.copyFileSync(tmpPath, copyPath);
      }
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
      fs.mkdirSync(path.dirname(extractDir), { recursive: true });
      fs.cpSync(stagedDir, extractDir, {
        recursive: true,
        verbatimSymlinks: true,
      });
      console.log('Extraction completed.');
    } catch (err) {
      console.error(`Error processing ${name}: ${err.message}`);
      process.exitCode = 1;
      return;
    } finally {
      // Clean up temporary file
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('\nAll prebuilt files have been processed successfully.');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
