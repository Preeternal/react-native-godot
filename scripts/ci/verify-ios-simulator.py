#!/usr/bin/env python3
"""Check that installed XCFrameworks contain the requested Simulator binaries."""

import argparse
import json
from pathlib import Path
import plistlib
import subprocess


def verify(root, architectures):
    package = json.loads((root / "package.json").read_text())
    entries = {entry["name"]: entry for entry in package["prebuiltFiles"]}
    for name in ("libgodot", "libgodot-cpp"):
        entry = entries[name]
        framework = (root / entry["destination_base_dir"] / name /
                     entry["version"] / (name + ".xcframework"))
        with (framework / "Info.plist").open("rb") as stream:
            libraries = plistlib.load(stream)["AvailableLibraries"]
        simulators = [item for item in libraries
                      if item.get("SupportedPlatform") == "ios" and
                      item.get("SupportedPlatformVariant") == "simulator"]
        matching = [item for item in simulators
                    if set(architectures).issubset(item["SupportedArchitectures"])]
        if len(matching) != 1:
            available = [item["SupportedArchitectures"] for item in simulators]
            raise ValueError(f"{name}: need Simulator {architectures}; available {available}")
        selected = matching[0]
        library = framework / selected["LibraryIdentifier"] / selected["LibraryPath"]
        binary = library / library.stem if library.suffix == ".framework" else library
        if not binary.is_file():
            raise ValueError(f"{name}: missing Simulator binary {binary}")
        actual = subprocess.check_output(
            ["xcrun", "lipo", "-archs", str(binary)], text=True).split()
        if not set(selected["SupportedArchitectures"]).issubset(actual):
            raise ValueError(f"{name}: Info.plist architectures differ from binary {actual}")
        print(f"{name}: {selected['LibraryIdentifier']} {architectures} PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--arch", action="append", dest="architectures")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    try:
        verify(args.root, args.architectures or ["arm64"])
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"iOS Simulator prebuilt check failed: {error}\n")
