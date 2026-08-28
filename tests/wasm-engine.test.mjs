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
    assert.equal(result.engine, "SidekickDMCore");
  } finally {
    exports.sidekickdm_dealloc(pointer);
  }
});
