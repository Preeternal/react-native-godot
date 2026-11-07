const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Apple renderer defaults and explicit requests match the target policy', (t) => {
  const compiler = [process.env.CXX, 'clang++', 'c++']
    .filter(Boolean)
    .find((candidate) => spawnSync(candidate, ['--version']).status === 0);
  if (!compiler) return t.skip('A C++20 compiler is unavailable');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'godot-renderer-policy-')
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'policy.cpp');
  fs.writeFileSync(
    source,
    `
#include "AppleRendererPolicy.h"
using rn_godot::select_apple_renderer;
constexpr auto device = select_apple_renderer(false);
static_assert(device.driver == "metal" && device.method == "mobile" && device.error.empty());
constexpr auto simulator = select_apple_renderer(true);
static_assert(simulator.driver == "opengl3" && simulator.method == "gl_compatibility" && simulator.error.empty());
static_assert(!select_apple_renderer(true, "metal", "mobile").error.empty());
static_assert(!select_apple_renderer(true, "metal").error.empty());
static_assert(select_apple_renderer(false, "opengl3").method == "gl_compatibility");
static_assert(select_apple_renderer(false, "", "gl_compatibility").driver == "opengl3");
static_assert(select_apple_renderer(false, "metal", "forward_plus").error.empty());
static_assert(!select_apple_renderer(false, "metal", "gl_compatibility").error.empty());
static_assert(!select_apple_renderer(true, "opengl3", "mobile").error.empty());
static_assert(select_apple_renderer(true, "opengl3_angle").method == "gl_compatibility");
static_assert(select_apple_renderer(false, "vulkan", "mobile").driver == "vulkan");
`
  );
  const result = spawnSync(
    compiler,
    [
      '-std=c++20',
      '-fsyntax-only',
      '-I',
      path.resolve(__dirname, '../../cpp'),
      source,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
