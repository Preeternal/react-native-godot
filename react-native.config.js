module.exports = {
  // Keep React Native's SwiftPM autolinker aligned with Package.swift.
  spm: {
    name: 'ReactNativeGodot',
  },
  dependency: {
    platforms: {
      android: {
        // Subdirectory paths in Android-autolinking.cmake are generated based on these:
        // Paths given are relative to the ./android folder:
        cmakeListsPath: './build/generated/source/codegen/jni/CMakeLists.txt',
      },
    },
  },
};
