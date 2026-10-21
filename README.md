# orthoflow

Orthogonal graph layout for diagrams, as a WebAssembly module with a small
typed API: give it nodes (with sizes, shapes, labels and nested containers)
and edges, get back node positions, orthogonal edge routes and label
positions.

orthoflow is an **unofficial, independent port of the TALA layout engine from
Terrastruct's D2** (<https://github.com/terrastruct/d2>), compiled from the Rust
port [orthoflow](https://github.com/nk-coding/orthoflow). It is **not
affiliated with or endorsed by Terrastruct**. "TALA" and "D2" are names of
Terrastruct Inc. and are used here only to describe where the code comes from.
The port is based on terrastruct/d2 commit
`6a7b4837838a3907604a1d9eec57ee98b6f3cd01` (2026-10-11).

Results are bit-identical to the Go engine (verified on 381 full layouts, all
37 pipeline stages of 81 fixtures and about 37,000 routing cases, see the Rust
repository). In Node it runs about 1.5× the time of native single-threaded Go
and over 3× faster than D2's Go code compiled to WebAssembly; the module is
3.7 MB (about 1 MB gzipped).

- ES module, TypeScript types, no runtime dependencies.
- Works in browsers (Vite, webpack and other bundlers that understand
  `new URL('./file', import.meta.url)`), in Node 18+ and in workers.

## Install

```sh
npm install orthoflow
```

## Usage

```ts
import { init, layout, type Graph } from 'orthoflow';

await init(); // loads orthoflow.wasm once

const input: Graph = {
  nodes: [
    { id: 1, width: 260, height: 200, topLeft: null, shapeType: 'Square',
      label: { Text: 'backend', Position: '', Width: 70, Height: 21 } },
    { id: 2, width: 108, height: 66, topLeft: null, shapeType: 'Square',
      label: { Text: 'api', Position: '', Width: 30, Height: 21 } },
    { id: 3, width: 108, height: 90, topLeft: null, shapeType: 'Cylinder',
      label: { Text: 'db', Position: '', Width: 25, Height: 21 } },
    { id: 4, width: 120, height: 66, topLeft: null, shapeType: 'Oval',
      label: { Text: 'client', Position: '', Width: 50, Height: 21 } },
  ],
  edges: [
    { id: 10, from: 4, to: 2, points: [], sourceArrowhead: '', targetArrowhead: 'triangle',
      label: { Text: 'HTTPS', Position: '', Width: 45, Height: 21 } },
    { id: 11, from: 2, to: 3, points: [], sourceArrowhead: '', targetArrowhead: 'triangle' },
  ],
  containers: { 0: [1, 4], 1: [2, 3] }, // "0" is the root; node 1 contains 2 and 3
};

const { graph, bestSeed, seeds } = layout(input);
for (const node of graph!.nodes) {
  console.log(node.id, node.topLeft, node.width, node.height, node.label?.Position);
}
for (const edge of graph!.edges) {
  console.log(edge.id, edge.points, edge.label?.Position, edge.labelPercentage);
}
```

### Browser and bundlers

`init()` without an argument loads the module from
`new URL('./orthoflow.wasm', import.meta.url)` relative to the package, which
Vite and webpack 5 turn into an asset automatically. To control where the file
comes from, pass a URL, for example with Vite:

```ts
import { init } from 'orthoflow';
import wasmUrl from 'orthoflow/orthoflow.wasm?url';

await init(wasmUrl);
```

In the Vite dev server, exclude the package from dependency pre-bundling so
the relative asset URL keeps working:

```ts
// vite.config.ts
export default { optimizeDeps: { exclude: ['orthoflow'] } };
```

Without a bundler, serve `node_modules/orthoflow/dist/` and import
`dist/index.js` (the module is fetched next to it), or pass any URL, `Response`,
`ArrayBuffer`/`Uint8Array` or compiled `WebAssembly.Module` to `init()`.

Layout is synchronous and CPU-heavy (milliseconds for small graphs, seconds for
large ones), so for big diagrams run it in a Web Worker.

### Node

```js
import { init, layout } from 'orthoflow';
await init(); // reads dist/orthoflow.wasm with fs
```

Or synchronously:

```js
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initSync, layout } from 'orthoflow';

const require = createRequire(import.meta.url);
initSync(readFileSync(require.resolve('orthoflow/orthoflow.wasm')));
```

## API

```ts
init(input?: URL | string | Response | BufferSource | WebAssembly.Module): Promise<void>
initSync(module: BufferSource | WebAssembly.Module): void
isInitialized(): boolean

layout(graph: string | Graph, options?: LayoutOptions): LayoutResult
layoutJson(graph: string | Graph, options?: LayoutOptions): string
layoutWithSeed(graph: string | Graph, seed: number | bigint, options?): LayoutResult
layoutWithSeedJson(graph: string | Graph, seed: number | bigint): string

interface LayoutOptions {
  seeds?: (number | bigint)[] | BigInt64Array; // default [1, 2, 3]
  unsafeIntegers?: 'bigint' | 'error' | 'number'; // default 'bigint'
}

interface LayoutResult {
  seeds: { seed: number | bigint; penalty?: number; area?: number; error?: string }[];
  bestSeed: number | bigint | null;
  graph: LaidOutGraph | null;
}
```

- `init` must have completed before the other functions are called.
- `layout` runs one full layout per seed, scores each one and returns the best
  (lowest penalty, then lowest area; exact ties go to the later seed). It
  throws an `Error` for invalid input. A seed that fails gets an `error`
  instead of scores; `bestSeed` and `graph` are `null` only if all seeds fail.
- `layoutJson` returns the same report as a JSON string, exactly as the Rust
  CLI prints it.
- The graph can be passed as a JSON string or as an object; `bigint` values in
  an object are written as exact JSON integers.

### 64-bit IDs

Entity IDs are signed 64-bit integers. D2 uses 63-bit hash IDs, and the engine
creates such IDs for the cluster/sequence vessels it adds to the result, so
results can contain integers above 2^53 that a JS `number` cannot hold.
`layout` never rounds them silently: by default (`unsafeIntegers: 'bigint'`)
they are returned as `bigint` (all other numbers stay numbers), so code that
compares IDs should accept both (`EntityID = number | bigint`). Use
`unsafeIntegers: 'error'` to get a `RangeError` instead, `'number'` for plain
(rounding) `JSON.parse`, or `layoutJson` to get the exact text and parse it
yourself. If your input IDs are above 2^53, pass them as `bigint` or pass the
graph as a JSON string.

## Graph format

The input and output use TALA's *graphjson* format; the TypeScript types
(`Graph`, `Node`, `Edge`, `Label`, `Point`, ...) are exported by the package.

Input:

| field | meaning |
|---|---|
| `nodes[].id` | node ID (signed 64-bit integer) |
| `nodes[].width`, `height` | size of the node |
| `nodes[].topLeft` | `null` |
| `nodes[].shapeType` | D2 shape: `Square`, `RealSquare`, `Parallelogram`, `Document`, `Cylinder`, `Queue`, `Page`, `Package`, `Step`, `Callout`, `StoredData`, `Person`, `C4Person`, `Diamond`, `Oval`, `Circle`, `Hexagon`, `Cloud`, `Table`, `Class`, `Text`, `Code`, `Image` |
| `nodes[].label` | optional `{ Text, Position: '', Width, Height }` (the size of the rendered text) |
| `edges[].id`, `from`, `to` | edge ID and endpoint node IDs |
| `edges[].points` | `[]` |
| `edges[].sourceArrowhead`, `targetArrowhead` | D2 arrowhead (`''`, `triangle`, `arrow`, `diamond`, `circle`, `box`, `cf-one`, ...) |
| `edges[].label` | optional, as for nodes |
| `containers` | container node ID → child node IDs; `"0"` is the root |

Optional D2 attributes (`icon`, `fixedTopLeft`, `nears`, `numColumns`,
`fromTableColumnIndex`, `style`, arrowhead labels, ...) are listed in the
types. The remaining graph fields (`clusters`, `trees`, `hierarchies`,
`CellSize`, costs, ...) are engine state; leave them out of inputs.

Output (`result.graph`):

- `nodes[].topLeft`, `width`, `height`: the final box of every node, including
  containers (the size can differ from the input: containers are sized around
  their children and nodes may grow to fit their edge ports);
- `edges[].points`: the orthogonal route from the source node border to the
  target node border;
- `nodes[].label.Position` and `edges[].label.Position`: the chosen D2 label
  position (`INSIDE_MIDDLE_CENTER`, `OUTSIDE_TOP_CENTER`, `UNLOCKED_BOTTOM`,
  ...). Node label positions are relative to the node box; edge labels sit on
  the route at `edges[].labelPercentage`, the way D2's `lib/label` places them.

## Building from source

The package is built from the Rust repository, included as the `orthoflow`
git submodule (or set `ORTHOFLOW_RUST_DIR`). You need Rust with the
`wasm32-unknown-unknown` target and `wasm-bindgen-cli` 0.2.129:

```sh
git submodule update --init
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129
npm install
npm run build   # orthoflow/scripts/build-wasm.sh + tsc -> dist/
npm test        # lays out fixtures from orthoflow/tests/fixtures and compares with Go's output
```

## License

The package is licensed under the [Mozilla Public License 2.0](LICENSE), like D2.
The WebAssembly module also contains code under other licenses: Go standard
library ports (BSD-3-Clause, with the FreeBSD msun/Sun Microsystems and Cephes
notices), the Rust standard library and Rust crates (MIT; dual-licensed
`MIT OR Apache-2.0` components are used under MIT) and Unicode data
(Unicode-3.0). Hence the package license expression
`MPL-2.0 AND BSD-3-Clause AND MIT AND Unicode-3.0`. [LICENSES](LICENSES)
lists every third-party component with its license text. The Source Code Form
of the module is the Rust repository <https://github.com/nk-coding/orthoflow>.

"TALA", "D2" and "Terrastruct" are names (and possibly trademarks) of
Terrastruct Inc., used here only to describe the origin of the code. This
package is not affiliated with, sponsored by or endorsed by Terrastruct Inc.
