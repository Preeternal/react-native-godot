module.exports = {
  name: 'ensure-prebuilts',
  factory: (require) => {
    const { InstallMode } = require('@yarnpkg/core');
    const { npath } = require('@yarnpkg/fslib');
    const { execFileSync } = require('node:child_process');
    const path = require('node:path');

    return {
      default: {
        hooks: {
          afterAllInstalled(project, { mode }) {
            if (
              mode === InstallMode.SkipBuild ||
              mode === InstallMode.UpdateLockfile
            ) {
              return;
            }

            // Yarn may cache postinstall across metadata-only branch changes.
            const cwd = npath.fromPortablePath(project.cwd);
            execFileSync(
              process.execPath,
              [path.join(cwd, 'scripts/download-prebuilt.js')],
              { cwd, stdio: 'inherit' }
            );
          },
        },
      },
    };
  },
};
