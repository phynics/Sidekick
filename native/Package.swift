// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SidekickDMNative",
    products: [
        .library(name: "SidekickDMCore", targets: ["SidekickDMCore"]),
        .executable(name: "sidekick-engine", targets: ["SidekickDMWeb"])
    ],
    targets: [
        .target(
            name: "SidekickDMCore",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .executableTarget(
            name: "SidekickDMWeb",
            dependencies: ["SidekickDMCore"],
            swiftSettings: [.swiftLanguageMode(.v6)],
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "--export=sidekickdm_protocol_version",
                    "-Xlinker", "--export=sidekickdm_alloc",
                    "-Xlinker", "--export=sidekickdm_dealloc",
                    "-Xlinker", "--export=sidekickdm_initialize",
                    "-Xlinker", "--export=sidekickdm_execute",
                    "-Xlinker", "--export=sidekickdm_result_ptr",
                    "-Xlinker", "--export=sidekickdm_result_len"
                ], .when(platforms: [.wasi]))
            ]
        ),
        .testTarget(
            name: "SidekickDMCoreTests",
            dependencies: ["SidekickDMCore"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
