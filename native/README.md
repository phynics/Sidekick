# Sidekick DM browser boundary

The native package builds `SidekickDMCore` and a small C-compatible Swift/Wasm executable. The core owns the encounter title, value, and revision. The browser only sends semantic commands and renders the returned projection.

The repository pins exact SDK, Swift toolchain, Node, and Chromium versions in `.toolchain-version`. The supported bootstrap uses Swift.org's macOS package and Wasm SDK URLs recorded in that file:

```text
curl -fL -o /private/tmp/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-13-a-osx.pkg https://download.swift.org/swift-6.4.x-branch/xcode/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-13-a/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-13-a-osx.pkg
installer -pkg /private/tmp/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-13-a-osx.pkg -target CurrentUserHomeDirectory
export SWIFT_EXEC="$(find /Library/Developer/Toolchains "/Users/$(id -un)/Library/Developer/Toolchains" -path "*/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-13-a.xctoolchain/usr/bin/swift" -type f -print -quit)"
"$SWIFT_EXEC" sdk install https://download.swift.org/swift-6.4.x-branch/wasm-sdk/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-14-a/swift-6.4.x-DEVELOPMENT-SNAPSHOT-2026-08-14-a_wasm.artifactbundle.tar.gz
"$SWIFT_EXEC" sdk list
volta install node@24.19.0
npx --yes @puppeteer/browsers install chrome@151.0.7922.174
export CHROMIUM_BIN="$(find "/Users/$(id -un)/.cache/puppeteer" -path "*chrome-mac-*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" -type f -print -quit)"
npm run check
```

From a clean checkout, run the commands above. The `find` commands select the exact installed toolchain and Chrome for Testing executable without assuming a user name. `npm run check` runs `npm run bootstrap` first, then builds the Wasm module, verifies the exports, and runs the Chromium smoke test.

`build-native.mjs` copies the executable to `public/wasm/sidekick-engine.wasm`. The static build copies `index.html`, CSS, JavaScript, the JSON asset, and the Wasm module to `dist/`. Serve `dist/` over HTTP because browser module and Wasm loading use HTTP URLs.

The browser loader supplies the minimal `wasi_snapshot_preview1` imports needed by this executable. The browser calls `sidekickdm_execute` through `src/wasm-engine.js`, and `src/app.js` owns the DOM and the tiny JavaScript bridge callback. `SidekickDMCore` has no browser dependency.

The native module owns each encoded result until the next initialize or execute call. JavaScript reads `sidekickdm_result_len`, allocates its own buffer, and calls `sidekickdm_result_copy` before decoding the response. `sidekickdm_result_ptr` remains available for compatibility and stays valid until the native module publishes the next result.
