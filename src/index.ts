// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright 2026 Niklas Krieger

/**
 * orthoflow: an orthogonal graph layout engine, compiled to WebAssembly.
 *
 * Unofficial, independent port of the TALA layout engine from Terrastruct's
 * D2 (https://github.com/terrastruct/d2); not affiliated with or endorsed by
 * Terrastruct.
 *
 * @example
 * ```ts
 * import { init, layout } from 'orthoflow';
 * await init();
 * const { graph, bestSeed } = layout(input);
 * ```
 * @module
 */

import wasmInit, { initSync as wasmInitSync, layout as wasmLayout, layoutWithSeed as wasmLayoutWithSeed } from './wasm/orthoflow_wasm.js';
import type { Graph, LayoutResult } from './types.js';
import { parseJson, stringifyJson } from './json.js';

export type * from './types.js';

/** What {@link init} accepts: a URL (or URL string / file path in Node), a fetch `Response`, the module bytes or a compiled module. */
export type InitInput = URL | string | Response | BufferSource | WebAssembly.Module;

/** Options of {@link layout} and {@link layoutJson}. */
export interface LayoutOptions {
  /**
   * Seeds to try (signed 64-bit integers). Every seed runs one full layout and
   * the best one is returned. Default (also for an empty array): `[1, 2, 3]`.
   */
  seeds?: readonly (number | bigint)[] | BigInt64Array;
  /**
   * How {@link layout} returns integers outside the safe range of JS numbers
   * (|x| > 2^53 - 1), such as D2's 63-bit entity IDs or the IDs of the
   * cluster/sequence vessels the engine creates:
   *
   * - `'bigint'` (default): as `bigint` (exact; all other numbers stay numbers),
   * - `'error'`: throw a `RangeError`,
   * - `'number'`: as rounded numbers (plain `JSON.parse`).
   *
   * {@link layoutJson} always returns the exact JSON text.
   */
  unsafeIntegers?: UnsafeIntegers;
}

/** See {@link LayoutOptions.unsafeIntegers}. */
export type UnsafeIntegers = 'bigint' | 'error' | 'number';

/** Options of {@link layoutWithSeed}. */
export type SingleSeedOptions = Pick<LayoutOptions, 'unsafeIntegers'>;

let initialized = false;
let initializing: Promise<void> | undefined;

const isNode = typeof process !== 'undefined' && typeof process.versions?.node === 'string';

async function readFileInNode(path: string | URL): Promise<Uint8Array> {
  // Hidden from bundlers: only reached in Node for file: URLs and paths.
  const specifier = 'node:fs/promises';
  const fs: { readFile(p: string | URL): Promise<Uint8Array> } = await import(/* @vite-ignore */ /* webpackIgnore: true */ specifier);
  return fs.readFile(path);
}

async function resolveInput(input: InitInput | Promise<InitInput> | undefined): Promise<Response | BufferSource | WebAssembly.Module> {
  let value = await (input ?? new URL('./orthoflow.wasm', import.meta.url));
  if (typeof value === 'string') {
    let url: URL | undefined;
    try {
      url = new URL(value);
    } catch {
      url = undefined;
    }
    if (url === undefined || (isNode && /^[A-Za-z]:[\\/]/.test(value))) {
      // Relative URL or file system path.
      if (isNode) {
        return readFileInNode(value);
      }
      return fetch(value);
    }
    value = url;
  }
  if (value instanceof URL) {
    if (value.protocol === 'file:' || value.protocol === 'node:') {
      return readFileInNode(value);
    }
    return fetch(value);
  }
  return value;
}

/**
 * Loads and instantiates the WebAssembly module. Call (and await) it once
 * before {@link layout}; later calls return immediately.
 *
 * Without an argument the module is loaded from
 * `new URL('./orthoflow.wasm', import.meta.url)`, which bundlers such as
 * Vite and webpack recognize as an asset. In Node, `file:` URLs and paths are
 * read with `fs`.
 */
export function init(input?: InitInput | Promise<InitInput>): Promise<void> {
  if (initialized) {
    return Promise.resolve();
  }
  if (initializing === undefined) {
    initializing = (async () => {
      const source = await resolveInput(input);
      await wasmInit({ module_or_path: source });
      initialized = true;
    })();
    initializing.catch(() => {
      initializing = undefined;
    });
  }
  return initializing;
}

/**
 * Synchronous variant of {@link init} for module bytes or a compiled
 * `WebAssembly.Module` (for example in a worker, or with
 * `fs.readFileSync(require.resolve('orthoflow/orthoflow.wasm'))`).
 */
export function initSync(module: BufferSource | WebAssembly.Module): void {
  if (initialized) {
    return;
  }
  wasmInitSync({ module });
  initialized = true;
}

/** Whether {@link init} or {@link initSync} has completed. */
export function isInitialized(): boolean {
  return initialized;
}

function ensureInitialized(): void {
  if (!initialized) {
    throw new Error('orthoflow: call `await init()` (or initSync) before layout');
  }
}

function toGraphJson(graph: string | Graph): string {
  return typeof graph === 'string' ? graph : stringifyJson(graph);
}

function toSeed(seed: number | bigint): bigint {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError(`orthoflow: seed ${seed} is not a safe integer; pass a bigint`);
    }
    return BigInt(seed);
  }
  if (typeof seed !== 'bigint' || BigInt.asIntN(64, seed) !== seed) {
    throw new RangeError(`orthoflow: seed ${String(seed)} is not a signed 64-bit integer`);
  }
  return seed;
}

function toSeeds(seeds: LayoutOptions['seeds']): BigInt64Array {
  if (seeds === undefined) {
    return new BigInt64Array(0);
  }
  if (seeds instanceof BigInt64Array) {
    return seeds;
  }
  return BigInt64Array.from(seeds, toSeed);
}

/**
 * Lays out a graph (graphjson, as a string or an object) with every seed and
 * returns the raw report JSON: `{"seeds":[...],"bestSeed":...,"graph":{...}}`.
 * Integers in the string are exact (63-bit IDs included).
 */
export function layoutJson(graph: string | Graph, options: LayoutOptions = {}): string {
  ensureInitialized();
  return wasmLayout(toGraphJson(graph), toSeeds(options.seeds));
}

/**
 * Lays out a graph with every seed (default 1, 2, 3) and returns the parsed
 * report with the best layout. Throws on invalid input.
 *
 * Integers above 2^53 (63-bit IDs) are returned as `bigint` by default, see
 * {@link LayoutOptions.unsafeIntegers}; {@link layoutJson} returns the raw JSON.
 */
export function layout(graph: string | Graph, options: LayoutOptions = {}): LayoutResult {
  return parseJson(layoutJson(graph, options), options.unsafeIntegers ?? 'bigint') as LayoutResult;
}

/** {@link layoutJson} with a single seed. */
export function layoutWithSeedJson(graph: string | Graph, seed: number | bigint): string {
  ensureInitialized();
  return wasmLayoutWithSeed(toGraphJson(graph), toSeed(seed));
}

/** {@link layout} with a single seed. */
export function layoutWithSeed(graph: string | Graph, seed: number | bigint, options: SingleSeedOptions = {}): LayoutResult {
  return parseJson(layoutWithSeedJson(graph, seed), options.unsafeIntegers ?? 'bigint') as LayoutResult;
}

/** Default seeds (the same as D2's). */
export const DEFAULT_SEEDS: readonly number[] = Object.freeze([1, 2, 3]);
