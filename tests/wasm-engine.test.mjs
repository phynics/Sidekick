import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadSidekickEngine } from "../src/wasm-engine.js";

const wasmURL = new URL("../public/wasm/sidekick-engine.wasm", import.meta.url);

async function loadEngine() {
  const bytes = await readFile(wasmURL);
  const fetcher = async () => ({
    ok: true,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  });
  const engine = await loadSidekickEngine({ fetcher });
  assert.equal(engine.available, true, engine.reason);
  return engine;
}

function readLegacyResult(instance) {
  const pointer = Number(instance.exports.sidekickdm_result_ptr());
  const length = Number(instance.exports.sidekickdm_result_len());
  return JSON.parse(new TextDecoder().decode(new Uint8Array(instance.exports.memory.buffer, pointer, length)));
}

test("successful commands advance the engine snapshot", async () => {
  const engine = await loadEngine();
  const revision = engine.snapshot.encounterRevision;

  const result = engine.execute({ command: "sidekick_increment", expected_revision: revision, origin: "test" });

  assert.equal(result.ok, true);
  assert.equal(engine.snapshot, result.snapshot);
  assert.equal(engine.snapshot.encounterRevision, revision + 1);
});

test("malformed command JSON returns invalid_request", async () => {
  const engine = await loadEngine();
  const { exports } = engine.instance;
  const payload = new TextEncoder().encode("[");
  const pointer = Number(exports.sidekickdm_alloc(payload.length));
  try {
    new Uint8Array(exports.memory.buffer, pointer, payload.length).set(payload);
    assert.equal(exports.sidekickdm_execute(pointer, payload.length), 0);
    assert.equal(readLegacyResult(engine.instance).error?.code, "invalid_request");
  } finally {
    exports.sidekickdm_dealloc(pointer);
  }
});

test("the result ABI copies bytes into caller-owned memory", async () => {
  const engine = await loadEngine();
  const { exports } = engine.instance;
  assert.equal(typeof exports.sidekickdm_result_copy, "function");

  const length = Number(exports.sidekickdm_result_len());
  const pointer = Number(exports.sidekickdm_alloc(length));
  try {
    assert.equal(exports.sidekickdm_result_copy(pointer, length), length);
    const result = JSON.parse(new TextDecoder().decode(new Uint8Array(exports.memory.buffer, pointer, length)));
    assert.equal(result.snapshot.engine, "SidekickDMCore");
  } finally {
    exports.sidekickdm_dealloc(pointer);
  }
});

test("loads the manifest-pinned engine and verifies native capabilities", async () => {
  const bytes = await readFile(wasmURL);
  const manifest = JSON.parse(await readFile(new URL("../public/wasm/sidekick-engine.manifest.json", import.meta.url), "utf8"));
  const calls = [];
  const fetcher = async url => {
    calls.push(String(url));
    if (String(url).includes("manifest")) return new Response(JSON.stringify(manifest), { status: 200 });
    return new Response(bytes, { status: 200 });
  };
  const engine = await loadSidekickEngine({ fetcher });
  assert.equal(engine.compatibility, "compatible");
  assert.equal(engine.capabilities.interfaceVersion, 2);
  assert.ok(engine.capabilities.supportedCommands.includes("sidekickdm_apply_generation_step"));
  assert.ok(calls.some(url => url.includes(`v=${manifest.build_id}`)));
});

test("fails safely when the manifest and Wasm bytes disagree", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/wasm/sidekick-engine.manifest.json", import.meta.url), "utf8"));
  const fetcher = async url => String(url).includes("manifest")
    ? new Response(JSON.stringify(manifest), { status: 200 })
    : new Response(new Uint8Array([0, 1, 2, 3]), { status: 200 });
  const engine = await loadSidekickEngine({ fetcher });
  assert.equal(engine.available, false);
  assert.equal(engine.compatibility, "update_required");
});

test("retries a stale cached Wasm response once without cache", async () => {
  const bytes = await readFile(wasmURL);
  const manifest = JSON.parse(await readFile(new URL("../public/wasm/sidekick-engine.manifest.json", import.meta.url), "utf8"));
  const calls = [];
  let assetCalls = 0;
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), cache: options.cache });
    if (String(url).includes("manifest")) return new Response(JSON.stringify(manifest), { status: 200 });
    assetCalls += 1;
    return new Response(assetCalls === 1 ? new Uint8Array([0, 1, 2, 3]) : bytes, { status: 200 });
  };
  const engine = await loadSidekickEngine({ fetcher });
  assert.equal(engine.available, true, engine.reason);
  assert.equal(assetCalls, 2);
  assert.equal(calls.at(-1).cache, "no-store");
  assert.match(calls.at(-1).url, /reload=/);
});
