// swift-tools-version: 6.0

import PackageDescription

let reactHeaders: [Target.Dependency] = [
  .product(name: "ReactHeaders", package: "ReactNative"),
  .product(name: "ReactNativeHeaders", package: "ReactNative"),
  .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
  .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
]

let libGodotVersion = "4.7.2.preeternal.1-rc.4"
let libGodotBaseURL = "https://github.com/Preeternal/libgodot/releases/download/\(libGodotVersion)"

let package = Package(
  name: "ReactNativeGodot",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "ReactNativeGodot", targets: ["ReactNativeGodot"]),
  ],
  dependencies: [
    // These paths are supplied by React Native's SPM autolinker under
    // ios/build/generated/autolinking/libs/ReactNativeGodot.
    .package(name: "ReactNative", path: "../../../../xcframeworks"),
    .package(name: "React-GeneratedCode", path: "../../../ios"),
    .package(name: "RNWorklets", path: "../RNWorklets"),
  ],
  targets: [
    .binaryTarget(
      name: "LibGodot",
      url: "\(libGodotBaseURL)/libgodot.xcframework.zip",
      checksum: "6bbf51634153ad9206352e36d069cbdf4e8a2a63e11e828a73b38e9a6adc5de5"
    ),
    .binaryTarget(
      name: "LibGodotCpp",
      url: "\(libGodotBaseURL)/libgodot-cpp.xcframework.zip",
      checksum: "a6a7f0737c9cd5eb981098fe253f794df27aafd14835f6889da3536de92d550e"
    ),
    .target(
      name: "ReactNativeGodotCpp",
      dependencies: ["LibGodotCpp", .product(name: "RNWorklets", package: "RNWorklets")] + reactHeaders,
      path: "cpp",
      publicHeadersPath: ".",
      cxxSettings: [
        .headerSearchPath("."),
        .unsafeFlags([
          "-DFOLLY_NO_CONFIG",
          "-DFOLLY_MOBILE=1",
          "-DFOLLY_USE_LIBCPP=1",
          "-DFOLLY_CFG_NO_COROUTINES=1",
          "-DFOLLY_HAVE_CLOCK_GETTIME=1",
          "-Wno-comma",
          "-Wno-shorten-64-to-32",
          "-DRN_FABRIC_ENABLED",
          "-fno-modules",
        ]),
        .define("DEBUG", .when(configuration: .debug)),
        .define("NDEBUG", .when(configuration: .release)),
        .define("RCT_NEW_ARCH_ENABLED", to: "1"),
        .define("RCT_REMOVE_LEGACY_ARCH", to: "1"),
      ]
    ),
    .target(
      name: "ReactNativeGodot",
      dependencies: ["ReactNativeGodotCpp", "LibGodot"] + reactHeaders,
      path: "ios",
      sources: [
        "GodotModule.mm",
        "NativeGodotModuleProvider.mm",
        "RTNGodotView.mm",
        "log.mm",
      ],
      publicHeadersPath: ".",
      cSettings: [
        .headerSearchPath("."),
        .headerSearchPath("../cpp"),
      ],
      cxxSettings: [
        .headerSearchPath("."),
        .headerSearchPath("../cpp"),
        .unsafeFlags([
          "-DFOLLY_NO_CONFIG",
          "-DFOLLY_MOBILE=1",
          "-DFOLLY_USE_LIBCPP=1",
          "-DFOLLY_CFG_NO_COROUTINES=1",
          "-DFOLLY_HAVE_CLOCK_GETTIME=1",
          "-Wno-comma",
          "-Wno-shorten-64-to-32",
          "-DRN_FABRIC_ENABLED",
          "-fno-modules",
        ]),
        .define("DEBUG", .when(configuration: .debug)),
        .define("NDEBUG", .when(configuration: .release)),
        .define("RCT_NEW_ARCH_ENABLED", to: "1"),
        .define("RCT_REMOVE_LEGACY_ARCH", to: "1"),
      ],
      linkerSettings: [
        .linkedFramework("AVFAudio"),
        .linkedFramework("Foundation"),
        .linkedFramework("UIKit"),
      ]
    ),
  ],
  swiftLanguageModes: [.v5],
  cxxLanguageStandard: .cxx20
)
