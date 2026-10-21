// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright 2026 Niklas Krieger

// Tests of the built package (run `npm run build` first). Fixtures and Go's
// expected outputs come from the Rust repository (the orthoflow submodule or
// ORTHOFLOW_RUST_DIR): tests/fixtures/{corpus,random}/{inputs,expected}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as ow from 'orthoflow';
import { parseJson } from '../dist/json.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rustDir = resolve(root, process.env.ORTHOFLOW_RUST_DIR ?? 'orthoflow');
const fixtures = join(rustDir, 'tests', 'fixtures');

// A mix of small and larger fixtures; several produce 63-bit vessel IDs.
const CORPUS = [
  'layout_multiple_connections',
  'layout_one_container',
  'layout_expand_cluster_other_dir',
  'layout_sequence',
  'layout_no-seq-in-cluster',
  'ovg_sql_tables',
  'layout_self_edges_all_shapes',
  'regression_container_escape_1',
];
const RANDOM_COUNT = 10;

function readFixture(set, name) {
  return {
    input: readFileSync(join(fixtures, set, 'inputs', `${name}.json`), 'utf8'),
    expected: readFileSync(join(fixtures, set, 'expected', `${name}.json`), 'utf8'),
  };
}

test('init loads the module in Node (default URL)', async () => {
  assert.equal(ow.isInitialized(), false);
  assert.throws(() => ow.layoutJson('{"nodes":[],"edges":[]}'), /init/);
  await ow.init();
  assert.equal(ow.isInitialized(), true);
  await ow.init(); // idempotent
});

test('corpus fixtures match Go exactly', async () => {
  await ow.init();
  for (const name of CORPUS) {
    const { input, expected } = readFixture('corpus', name);
    // Same report, compared as values (Go prints 354 where serde prints 354.0).
    const want = parseJson(expected, 'bigint');
    assert.deepStrictEqual(ow.layout(input), want, name);
    assert.deepStrictEqual(parseJson(ow.layoutJson(input, { seeds: [1, 2, 3] }), 'bigint'), want, name);
  }
});

test('random fixtures match Go exactly', async () => {
  await ow.init();
  const names = readdirSync(join(fixtures, 'random', 'inputs'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .slice(0, RANDOM_COUNT)
    .map((f) => f.slice(0, -5));
  assert.equal(names.length, RANDOM_COUNT);
  for (const name of names) {
    const { input, expected } = readFixture('random', name);
    assert.deepStrictEqual(ow.layout(JSON.parse(input), { seeds: [1n, 2n, 3n] }), parseJson(expected, 'bigint'), name);
  }
});

test('63-bit IDs survive', async () => {
  await ow.init();
  const { input, expected } = readFixture('corpus', 'layout_expand_cluster_other_dir');
  const json = ow.layoutJson(input);
  assert.match(json, /\d{19}/, 'fixture produces 63-bit vessel IDs');
  const result = ow.layout(input);
  const vesselIds = Object.values(result.graph.clusterVessels).map((n) => n.id);
  assert.ok(vesselIds.length > 0 && vesselIds.every((id) => typeof id === 'bigint'));
  for (const id of vesselIds) {
    assert.ok(json.includes(`"id":${id}`), `exact ID ${id} in the JSON text`);
  }
  assert.throws(() => ow.layout(input, { unsafeIntegers: 'error' }), RangeError);
  assert.equal(typeof Object.values(ow.layout(input, { unsafeIntegers: 'number' }).graph.clusterVessels)[0].id, 'number');

  // bigint IDs in an object input are written exactly.
  const big = 4611686018427387905n; // 2^62 + 1
  const graph = {
    nodes: [
      { id: big, width: 100, height: 60, topLeft: null, shapeType: 'Square' },
      { id: 2, width: 100, height: 60, topLeft: null, shapeType: 'Oval' },
    ],
    edges: [{ id: big + 1n, from: big, to: 2, points: [], sourceArrowhead: '', targetArrowhead: 'triangle' }],
    containers: { 0: [big, 2] },
  };
  const out = ow.layout(graph);
  assert.equal(out.graph.nodes.find((n) => n.id === big)?.id, big);
  assert.equal(out.graph.edges[0].id, big + 1n);
  assert.equal(out.graph.edges[0].from, big);
  void expected;
});

test('seeds and layoutWithSeed', async () => {
  await ow.init();
  const { input } = readFixture('corpus', 'layout_one_container');
  const all = ow.layout(input);
  assert.deepStrictEqual(all.seeds.map((s) => s.seed), [1, 2, 3]);
  assert.deepStrictEqual(ow.layout(input, { seeds: [] }), all);
  const single = ow.layoutWithSeed(input, all.bestSeed);
  assert.equal(single.bestSeed, all.bestSeed);
  assert.deepStrictEqual(single.seeds, [all.seeds.find((s) => s.seed === all.bestSeed)]);
  assert.deepStrictEqual(single.graph, all.graph);
  assert.equal(ow.layoutWithSeedJson(input, 7n), ow.layoutJson(input, { seeds: [7] }));
  assert.throws(() => ow.layout(input, { seeds: [1.5] }), RangeError);
  assert.throws(() => ow.layout(input, { seeds: [2n ** 63n] }), RangeError);
});

test('invalid input throws', async () => {
  await ow.init();
  assert.throws(() => ow.layout('{"nodes": ['), Error);
  assert.throws(() => ow.layout('{"nodes":[{"id":1,"width":10,"height":10,"shapeType":"Square"}],"edges":[{"id":2,"from":1,"to":99,"points":[]}]}'), Error);
});

test('exported wasm path resolves', () => {
  const require = createRequire(import.meta.url);
  const viaRequire = require.resolve('orthoflow/orthoflow.wasm');
  const viaImport = fileURLToPath(import.meta.resolve('orthoflow/orthoflow.wasm'));
  const built = join(root, 'dist', 'orthoflow.wasm');
  assert.equal(viaRequire, built);
  assert.equal(viaImport, built);
  assert.ok(existsSync(built));
  const bytes = readFileSync(built);
  assert.ok(WebAssembly.validate(bytes));
  assert.equal(require.resolve('orthoflow/package.json'), join(root, 'package.json'));
  // The default URL used by init() is the same file.
  assert.equal(fileURLToPath(new URL('./orthoflow.wasm', import.meta.resolve('orthoflow'))), built);
});

test('initSync and init(path) in fresh processes', () => {
  const wasm = join(root, 'dist', 'orthoflow.wasm');
  const index = pathToFileURL(join(root, 'dist', 'index.js')).href;
  const input = JSON.stringify(readFixture('corpus', 'layout_multiple_connections').input);
  const scripts = [
    `import { initSync, layoutJson } from ${JSON.stringify(index)};
     import { readFileSync } from 'node:fs';
     initSync(new WebAssembly.Module(readFileSync(${JSON.stringify(wasm)})));
     process.stdout.write(layoutJson(${input}));`,
    `import { init, layoutJson } from ${JSON.stringify(index)};
     await init(${JSON.stringify(wasm)});
     process.stdout.write(layoutJson(${input}));`,
    `import { init, layoutJson } from ${JSON.stringify(index)};
     import { readFileSync } from 'node:fs';
     await init(readFileSync(${JSON.stringify(wasm)}));
     process.stdout.write(layoutJson(${input}));`,
  ];
  const outputs = scripts.map((s) => execFileSync(process.execPath, ['--input-type=module', '-e', s], { encoding: 'utf8' }));
  const want = parseJson(readFixture('corpus', 'layout_multiple_connections').expected, 'bigint');
  for (const out of outputs) {
    assert.deepStrictEqual(parseJson(out, 'bigint'), want);
  }
});
