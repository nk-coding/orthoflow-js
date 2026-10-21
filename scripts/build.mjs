// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright 2026 Niklas Krieger

// Builds the package from the orthoflow Rust repository:
//   1. <rust>/scripts/build-wasm.sh <tmp> web   (cargo + wasm-bindgen --target web)
//   2. copies the wasm-bindgen glue to src/wasm/ (for tsc) and dist/wasm/,
//      and the module to dist/orthoflow.wasm
//   3. tsc (src/*.ts -> dist/*.js + *.d.ts)
// The Rust repository defaults to the orthoflow submodule; override with ORTHOFLOW_RUST_DIR.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rustDir = resolve(root, process.env.ORTHOFLOW_RUST_DIR ?? 'orthoflow');
const script = join(rustDir, 'scripts', 'build-wasm.sh');
if (!existsSync(script)) {
  console.error(`orthoflow Rust repository not found at ${rustDir} (set ORTHOFLOW_RUST_DIR)`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'orthoflow-wasm-'));
try {
  execFileSync(script, [tmp, 'web'], { stdio: 'inherit' });
  const files = readdirSync(tmp);
  const unexpected = files.filter((f) => !/^orthoflow_wasm(\.js|\.d\.ts|_bg\.wasm|_bg\.wasm\.d\.ts)$/.test(f));
  if (unexpected.length > 0) {
    throw new Error(`unexpected wasm-bindgen output (update scripts/build.mjs and "files"): ${unexpected.join(', ')}`);
  }

  // The glue's own default URL would point at a file we do not ship; point it
  // at the packaged module so bundlers resolve a single asset.
  const glueIn = readFileSync(join(tmp, 'orthoflow_wasm.js'), 'utf8');
  const defaultUrl = "new URL('orthoflow_wasm_bg.wasm', import.meta.url)";
  if (!glueIn.includes(defaultUrl)) {
    throw new Error('wasm-bindgen glue does not contain the expected default module URL');
  }
  const glue = glueIn.replace(defaultUrl, "new URL('../orthoflow.wasm', import.meta.url)");
  const dts = readFileSync(join(tmp, 'orthoflow_wasm.d.ts'), 'utf8');

  rmSync(join(root, 'dist'), { recursive: true, force: true });
  for (const dir of [join(root, 'src', 'wasm'), join(root, 'dist', 'wasm')]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'orthoflow_wasm.js'), glue);
    writeFileSync(join(dir, 'orthoflow_wasm.d.ts'), dts);
  }
  copyFileSync(join(tmp, 'orthoflow_wasm_bg.wasm'), join(root, 'dist', 'orthoflow.wasm'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], {
  stdio: 'inherit',
});
console.log('built dist/');
