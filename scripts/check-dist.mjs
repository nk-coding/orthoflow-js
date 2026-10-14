// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright 2026 Niklas Krieger

// prepack guard: refuse to pack without a build.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['dist/index.js', 'dist/index.d.ts', 'dist/types.d.ts', 'dist/json.js', 'dist/orthoflow.wasm', 'dist/wasm/orthoflow_wasm.js'];
const missing = required.filter((f) => !existsSync(join(root, f)));
if (missing.length > 0) {
  console.error(`missing ${missing.join(', ')}: run \`npm run build\` first`);
  process.exit(1);
}
