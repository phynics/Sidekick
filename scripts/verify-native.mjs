import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const wasmBytes = readFileSync(resolve(root, "public/wasm/sidekick-engine.wasm"));
const module = new WebAssembly.Module(wasmBytes);
const exports = new Set(WebAssembly.Module.exports(module).map(({ name }) => name));
for (const name of ["memory", "_start", "sidekickdm_protocol_version", "sidekickdm_alloc", "sidekickdm_dealloc", "sidekickdm_initialize", "sidekickdm_execute", "sidekickdm_result_ptr", "sidekickdm_result_len", "sidekickdm_result_copy"]) {
  if (!exports.has(name)) throw new Error(`Native engine export missing: ${name}`);
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(wasmBytes, { status: 200 });
try {
  const { loadSidekickEngine } = await import("../src/wasm-engine.js");
  const engine = await loadSidekickEngine({ url: "./public/wasm/sidekick-engine.wasm" });
  if (!engine.available || engine.snapshot.engine !== "SidekickDMCore") throw new Error("Sidekick DM engine did not initialize from the Wasm artifact.");
  let result = engine.execute({ command: "sidekick_increment", expected_revision: 0 });
  if (!result.ok || result.snapshot.draft.swiftOwnedValue !== 8 || result.snapshot.draft.revision !== 1) throw new Error("Swift-owned state did not change through the command ABI.");
  result = engine.execute({ command: "sidekickdm_set_party_snapshot", effective_level: 5, size: 5, expected_revision: 1 });
  if (!result.ok || result.snapshot.budget.constructionBudget !== 100 || result.snapshot.budget.baseXPAward !== 80) throw new Error("Party-size budget adjustment or base award is incorrect.");
  result = engine.execute({ command: "sidekickdm_set_threat_target", kind: "severe", expected_revision: 2 });
  if (!result.ok || result.snapshot.budget.constructionBudget !== 150 || result.snapshot.budget.baseXPAward !== 120) throw new Error("Threat target budget does not match the golden PF2 fixture.");
  result = engine.execute({ command: "sidekickdm_add_participant_group", name: "Fixture Creature", level: 5, quantity: 2, expected_revision: 3 });
  if (!result.ok || result.snapshot.budget.guaranteedXP !== 80 || result.snapshot.budget.totalEncounterXP !== 80) throw new Error("Creature XP does not match the golden PF2 fixture.");
  result = engine.execute({ command: "sidekickdm_set_threat_target", kind: "low", expected_revision: 3 });
  if (result.ok || result.error?.code !== "stale_revision" || result.snapshot.draft.revision !== 4) throw new Error("Stale expected revisions were not rejected atomically.");
  result = engine.execute({ command: "sidekickdm_undo", expected_revision: 4 });
  if (!result.ok || result.snapshot.draft.participantGroups.length !== 0 || result.snapshot.draft.revision !== 5) throw new Error("Undo did not restore authored state with a new revision.");
  result = engine.execute({ command: "sidekickdm_redo", expected_revision: 5 });
  if (!result.ok || result.snapshot.draft.participantGroups.length !== 1 || result.snapshot.draft.revision !== 6) throw new Error("Redo did not restore the undone mutation.");
  result = engine.execute({ command: "sidekickdm_undo", expected_revision: 6 });
  result = engine.execute({ command: "sidekickdm_set_threat_target", kind: "low", expected_revision: 7 });
  result = engine.execute({ command: "sidekickdm_redo", expected_revision: 8 });
  if (result.ok || result.error?.code !== "nothing_to_redo") throw new Error("A new mutation did not clear the redo branch.");
  console.log("Native Sidekick DM WebAssembly artifact, PF2 golden math, stale writes, and Undo/Redo passed.");
} finally {
  globalThis.fetch = originalFetch;
}
