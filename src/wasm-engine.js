const WASI_MODULE = "wasi_snapshot_preview1";
const ERRNO_SUCCESS = 0;
const ERRNO_NOSYS = 52;
export const ENGINE_INTERFACE_VERSION = 2;
export const DEFAULT_ENGINE_URL = "./public/wasm/sidekick-engine.wasm";
export const DEFAULT_ENGINE_MANIFEST_URL = "./public/wasm/sidekick-engine.manifest.json";

function view(instance) {
  return new DataView(instance.exports.memory.buffer);
}

function u32(instance, address, value) {
  view(instance).setUint32(address, value >>> 0, true);
}

function u64(instance, address, value) {
  view(instance).setBigUint64(address, BigInt(value), true);
}

export function createWasiImports(getInstance) {
  const withMemory = (operation) => (...args) => {
    const instance = getInstance();
    return instance ? operation(instance, ...args) : ERRNO_NOSYS;
  };
  const noSys = () => ERRNO_NOSYS;
  return {
    args_get: withMemory(() => ERRNO_SUCCESS),
    args_sizes_get: withMemory((instance, count, size) => { u32(instance, count, 0); u32(instance, size, 0); return ERRNO_SUCCESS; }),
    environ_get: withMemory(() => ERRNO_SUCCESS),
    environ_sizes_get: withMemory((instance, count, size) => { u32(instance, count, 0); u32(instance, size, 0); return ERRNO_SUCCESS; }),
    clock_res_get: withMemory((instance, _clock, resolution) => { u64(instance, resolution, 1_000_000); return ERRNO_SUCCESS; }),
    clock_time_get: withMemory((instance, _clock, _precision, time) => { u64(instance, time, Date.now() * 1_000_000); return ERRNO_SUCCESS; }),
    fd_close: () => ERRNO_SUCCESS,
    fd_fdstat_get: withMemory((instance, _fd, stat) => { new Uint8Array(instance.exports.memory.buffer, stat, 24).fill(0); return ERRNO_SUCCESS; }),
    fd_fdstat_set_flags: () => ERRNO_SUCCESS,
    fd_filestat_get: withMemory((instance, _fd, stat) => { new Uint8Array(instance.exports.memory.buffer, stat, 64).fill(0); return ERRNO_SUCCESS; }),
    fd_filestat_set_size: () => ERRNO_SUCCESS,
    fd_filestat_set_times: () => ERRNO_SUCCESS,
    fd_pread: noSys,
    fd_prestat_get: noSys,
    fd_prestat_dir_name: noSys,
    fd_read: noSys,
    fd_readdir: noSys,
    fd_seek: noSys,
    fd_sync: () => ERRNO_SUCCESS,
    fd_tell: noSys,
    fd_write: withMemory((instance, _fd, iovs, length, written) => {
      let total = 0;
      for (let index = 0; index < length; index += 1) total += view(instance).getUint32(iovs + index * 8 + 4, true);
      u32(instance, written, total);
      return ERRNO_SUCCESS;
    }),
    proc_exit: () => ERRNO_SUCCESS,
    path_create_directory: noSys,
    path_filestat_get: noSys,
    path_filestat_set_times: noSys,
    path_link: noSys,
    path_open: noSys,
    path_readlink: noSys,
    path_remove_directory: noSys,
    path_rename: noSys,
    path_symlink: noSys,
    path_unlink_file: noSys,
    poll_oneoff: noSys,
    random_get: withMemory((instance, address, length) => {
      const bytes = new Uint8Array(instance.exports.memory.buffer, address, length);
      if (globalThis.crypto?.getRandomValues) {
        for (let offset = 0; offset < bytes.length; offset += 65_536) {
          globalThis.crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
        }
      }
      else bytes.fill(0);
      return ERRNO_SUCCESS;
    })
  };
}

function readResult(instance) {
  const length = Number(instance.exports.sidekickdm_result_len());
  if (length <= 0) throw new Error("Sidekick DM returned an empty result.");
  if (typeof instance.exports.sidekickdm_result_copy === "function") {
    const pointer = Number(instance.exports.sidekickdm_alloc(length));
    if (!pointer) throw new Error("Sidekick DM could not allocate a result buffer.");
    try {
      const copied = Number(instance.exports.sidekickdm_result_copy(pointer, length));
      if (copied !== length) throw new Error("Sidekick DM returned an incomplete result.");
      return JSON.parse(new TextDecoder().decode(new Uint8Array(instance.exports.memory.buffer, pointer, length)));
    } finally {
      instance.exports.sidekickdm_dealloc(pointer);
    }
  }
  const pointer = Number(instance.exports.sidekickdm_result_ptr());
  if (!pointer) throw new Error("Sidekick DM returned an empty result.");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(instance.exports.memory.buffer, pointer, length)));
}

function withQuery(url, key, value) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

async function readJSON(response) {
  if (typeof response.json === "function") return response.json();
  return JSON.parse(await response.text());
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("The browser does not provide SHA-256 support for the Wasm integrity check.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function capabilityValue(value, snake, fallback = null) {
  return value?.[snake] ?? value?.[snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] ?? fallback;
}

function readEngineCapabilities(instance) {
  if (typeof instance.exports.sidekickdm_engine_capabilities !== "function") {
    throw new Error("Sidekick DM engine is outdated. Reload the page to update the native engine.");
  }
  if (instance.exports.sidekickdm_engine_capabilities() !== 1) throw new Error("Sidekick DM engine could not describe its capabilities.");
  const result = readResult(instance);
  return {
    protocolVersion: Number(capabilityValue(result, "protocol_version", 0)),
    interfaceVersion: Number(capabilityValue(result, "interface_version", 0)),
    supportedCommands: Array.isArray(capabilityValue(result, "supported_commands", [])) ? capabilityValue(result, "supported_commands", []) : [],
    features: capabilityValue(result, "features", {}) ?? {}
  };
}

export async function loadSidekickEngine({ url = DEFAULT_ENGINE_URL, manifestUrl = DEFAULT_ENGINE_MANIFEST_URL, fetcher = globalThis.fetch } = {}) {
  try {
    let manifest = null;
    if (manifestUrl) {
      const manifestResponse = await fetcher(manifestUrl, { cache: "no-store" });
      if (manifestResponse.ok) {
        try { manifest = await readJSON(manifestResponse); }
        catch { manifest = null; }
      }
    }
    let assetURL = url;
    if (manifest?.asset && !url.includes("/")) assetURL = manifest.asset;
    if (manifest?.build_id) assetURL = withQuery(assetURL, "v", manifest.build_id);
    let response = await fetcher(assetURL, { cache: manifest?.build_id ? "force-cache" : "default" });
    if (!response.ok) throw new Error(`Sidekick DM Wasm asset returned HTTP ${response.status}.`);
    let bytes = await response.arrayBuffer();
    if (manifest?.build_id) {
      let actual = await sha256(bytes);
      if (actual !== manifest.build_id) {
        response = await fetcher(withQuery(url, "reload", Date.now()), { cache: "no-store" });
        if (!response.ok) throw new Error(`Sidekick DM Wasm asset returned HTTP ${response.status}.`);
        bytes = await response.arrayBuffer();
        actual = await sha256(bytes);
        if (actual !== manifest.build_id) throw new Error("Sidekick DM Wasm asset does not match its build manifest. Reload the page to update the app.");
      }
    }
    const module = await WebAssembly.compile(bytes);
    let instance = null;
    const imports = { [WASI_MODULE]: createWasiImports(() => instance) };
    const created = await WebAssembly.instantiate(module, imports);
    instance = created.instance ?? created;
    if (typeof instance.exports._start === "function") instance.exports._start();
    if (instance.exports.sidekickdm_protocol_version() !== 1) throw new Error("Unsupported Sidekick DM boundary protocol.");
    if (instance.exports.sidekickdm_initialize() !== 1) throw new Error("Sidekick DM engine did not initialize.");
    const initializedSnapshot = readResult(instance);
    const nativeCapabilities = readEngineCapabilities(instance);
    if (nativeCapabilities.protocolVersion !== 1 || nativeCapabilities.interfaceVersion !== ENGINE_INTERFACE_VERSION) throw new Error("Sidekick DM engine interface is incompatible. Reload the page to update the app.");
    const buildID = manifest?.build_id ?? await sha256(bytes);
    const snapshotResult = execute(instance, { command: "sidekickdm_get_budget" });
    const initialSnapshot = snapshotResult?.snapshot ?? initializedSnapshot;
    const engine = { available: true, instance, snapshot: initialSnapshot, execute: null, buildID, manifest, capabilities: nativeCapabilities, compatibility: "compatible" };
    engine.execute = (command) => {
      const result = execute(instance, command);
      if (result?.ok && result.snapshot) engine.snapshot = result.snapshot;
      return result;
    };
    return engine;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const compatibility = /outdated|incompatible|manifest|does not match|Reload the page/i.test(reason) ? "update_required" : "unavailable";
    return { available: false, instance: null, snapshot: null, reason, execute: null, capabilities: null, manifest: null, buildID: null, compatibility };
  }
}

function execute(instance, command) {
  const payload = new TextEncoder().encode(JSON.stringify(command));
  const pointer = Number(instance.exports.sidekickdm_alloc(payload.length));
  if (!pointer) throw new Error("Sidekick DM could not allocate a command buffer.");
  try {
    new Uint8Array(instance.exports.memory.buffer, pointer, payload.length).set(payload);
    instance.exports.sidekickdm_execute(pointer, payload.length);
    return readResult(instance);
  } finally {
    instance.exports.sidekickdm_dealloc(pointer);
  }
}
