"""Exercise Simulator slice selection without Xcode builds or downloaded fixtures."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "ci/verify-ios-simulator.py"
SPEC = importlib.util.spec_from_file_location("ios_simulator", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SimulatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        entries = []
        self.plists = {}
        for name in ("libgodot", "libgodot-cpp"):
            entries.append(dict(name=name, destination_base_dir="ios/libs",
                                version="fixture", filename=name + ".xcframework.zip"))
            framework = self.root / "ios/libs" / name / "fixture" / (name + ".xcframework")
            binary = framework / "ios-arm64-simulator" / (name + ".framework") / name
            binary.parent.mkdir(parents=True)
            binary.write_bytes(b"inert binary fixture")
            self.plists[name] = framework / "Info.plist"
            self.write_slice(name)
        (self.root / "package.json").write_text(json.dumps(dict(prebuiltFiles=entries)))

    def write_slice(self, name, platform="ios", variant="simulator", architectures=None):
        entry = dict(LibraryIdentifier="ios-arm64-simulator",
                     LibraryPath=name + ".framework", SupportedPlatform=platform,
                     SupportedPlatformVariant=variant,
                     SupportedArchitectures=architectures or ["arm64"])
        self.plists[name].write_bytes(plistlib.dumps(dict(AvailableLibraries=[entry])))

    def verify(self, architectures, binary_architectures="arm64"):
        with patch.object(MODULE.subprocess, "check_output", return_value=binary_architectures), \
                contextlib.redirect_stdout(io.StringIO()):
            MODULE.verify(self.root, architectures)

    def test_arm64_packages(self):
        self.write_slice("libgodot-cpp", architectures=["arm64", "x86_64"])
        self.verify(["arm64"], "arm64 x86_64")

    def test_universal_request_rejected_for_arm64_engine(self):
        with self.assertRaisesRegex(ValueError, "need Simulator"):
            self.verify(["arm64", "x86_64"])

    def test_device_slice_does_not_substitute_for_simulator(self):
        self.write_slice("libgodot", variant="")
        with self.assertRaisesRegex(ValueError, "available \\[\\]"):
            self.verify(["arm64"])

    def test_cpp_slice_must_also_support_architecture(self):
        self.write_slice("libgodot-cpp", architectures=["x86_64"])
        with self.assertRaisesRegex(ValueError, "libgodot-cpp: need Simulator"):
            self.verify(["arm64"])

    def test_metadata_cannot_substitute_for_binary_architecture(self):
        with self.assertRaisesRegex(ValueError, "differ from binary"):
            self.verify(["arm64"], "x86_64")

    def test_missing_binary(self):
        binary = self.plists["libgodot"].parent / "ios-arm64-simulator/libgodot.framework/libgodot"
        binary.unlink()
        with self.assertRaisesRegex(ValueError, "missing Simulator binary"):
            self.verify(["arm64"])


if __name__ == "__main__":
    unittest.main()
