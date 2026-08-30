import { loadSidekickEngine } from "./wasm-engine.js?v=3";

async function fetchJsonAsset(url, fetcher = globalThis.fetch) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Encounter Brief returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error("Encounter Brief contains invalid JSON.");
  }
}

export async function loadBootAssets({
  assetUrl = "./public/data/demo-encounter.v1.json",
  fetcher = globalThis.fetch,
  nativeLoader = loadSidekickEngine
} = {}) {
  const [asset, engine] = await Promise.all([fetchJsonAsset(assetUrl, fetcher), nativeLoader()]);
  return { asset, engine };
}
