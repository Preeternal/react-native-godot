#!/usr/bin/env bash
set -euo pipefail

elf_cmd=""
elf_cmd_kind=""

find_elf_tool() {
  local candidates=(
    "llvm-readelf:readelf"
    "readelf:readelf"
    "greadelf:readelf"
    "/opt/homebrew/opt/llvm/bin/llvm-readelf:readelf"
    "/usr/local/opt/llvm/bin/llvm-readelf:readelf"
    "/opt/homebrew/bin/greadelf:readelf"
    "/usr/local/bin/greadelf:readelf"
    "llvm-objdump:objdump"
    "/opt/homebrew/opt/llvm/bin/llvm-objdump:objdump"
    "/usr/local/opt/llvm/bin/llvm-objdump:objdump"
  )

  for candidate in "${candidates[@]}"; do
    local path="${candidate%%:*}"
    local kind="${candidate##*:}"

    if command -v "$path" >/dev/null 2>&1; then
      elf_cmd="$(command -v "$path")"
      elf_cmd_kind="$kind"
      return 0
    fi
    if [ -x "$path" ]; then
      elf_cmd="$path"
      elf_cmd_kind="$kind"
      return 0
    fi
  done

  if command -v xcrun >/dev/null 2>&1; then
    local xcrun_objdump
    xcrun_objdump="$(xcrun --find llvm-objdump 2>/dev/null || true)"
    if [ -x "$xcrun_objdump" ]; then
      elf_cmd="$xcrun_objdump"
      elf_cmd_kind="objdump"
      return 0
    fi
  fi

  return 1
}

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  if command -v llvm-readelf >/dev/null 2>&1; then
    elf_cmd="llvm-readelf"
    elf_cmd_kind="readelf"
  elif command -v readelf >/dev/null 2>&1; then
    elf_cmd="readelf"
    elf_cmd_kind="readelf"
  elif command -v greadelf >/dev/null 2>&1; then
    elf_cmd="greadelf"
    elf_cmd_kind="readelf"
  elif command -v llvm-objdump >/dev/null 2>&1; then
    elf_cmd="llvm-objdump"
    elf_cmd_kind="objdump"
  fi
else
  find_elf_tool || true
fi

if [ -z "$elf_cmd" ]; then
  echo "ERROR: no ELF inspection tool found (llvm-readelf, readelf, greadelf, or llvm-objdump)" >&2
  if [ "${GITHUB_ACTIONS:-}" != "true" ]; then
    echo "Tip: brew install llvm (llvm-readelf/llvm-objdump) or binutils (greadelf), or export PATH to include them." >&2
  fi
  exit 1
fi

print_load_alignments() {
  if [ "$elf_cmd_kind" = "objdump" ]; then
    "$elf_cmd" --private-headers "$1" | awk '$1 == "LOAD" { print $1, $NF }'
  else
    "$elf_cmd" -l -W "$1" | awk '$1 == "LOAD" { print $1, $NF }'
  fi
}

# Check the final stripped native libraries used by the example APK. Android's
# current Play requirement applies to 64-bit device variants, so arm64-v8a is
# the ABI that must be 16KB-aligned here.
search_roots=(example/android/app/build/intermediates/stripped_native_libs)
files=()

while IFS= read -r file; do
  [ -n "$file" ] && files+=("$file")
done < <(
  if command -v rg >/dev/null 2>&1; then
    rg --files "${search_roots[@]}" \
      | rg '/arm64-v8a/[^/]+\.so$' \
      || true
  else
    find "${search_roots[@]}" -type f \
      -path '*/arm64-v8a/*.so' \
      -print 2>/dev/null || true
  fi
)

if [ "${#files[@]}" -eq 0 ]; then
  echo "ERROR: no arm64-v8a native libraries found; build Android first" >&2
  echo "Searched: ${search_roots[*]}" >&2
  exit 1
fi

for so in "${files[@]}"; do
  echo "Checking 16KB alignment: $so"

  if print_load_alignments "$so" | awk '
    $1 == "LOAD" {
      load = 1
      if ($NF != "0x4000" && $NF != "2**14") bad = 1
    }
    END {
      if (!load) exit 2
      exit bad
    }
  '; then
    :
  else
    status=$?
    if [ "$status" -eq 2 ]; then
      echo "ERROR: no LOAD segments found for $so" >&2
    else
      echo "ERROR: expected 16KB alignment (0x4000 or 2**14) for $so" >&2
    fi
    print_load_alignments "$so" || true
    exit 1
  fi
done

echo "OK: 16KB alignment verified for ${#files[@]} native libraries"
