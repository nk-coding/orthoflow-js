// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright 2026 Niklas Krieger

// JSON helpers that keep 64-bit integers exact.

/** Positions [start, end) of integer literals outside the safe JS range. */
function unsafeIntegers(text: string): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 0x22 /* " */) {
      i++;
      while (i < n) {
        const d = text.charCodeAt(i);
        if (d === 0x5c /* \ */) {
          i += 2;
        } else if (d === 0x22) {
          i++;
          break;
        } else {
          i++;
        }
      }
    } else if (c === 0x2d /* - */ || (c >= 0x30 && c <= 0x39)) {
      const start = i;
      let integer = true;
      i++;
      while (i < n) {
        const d = text.charCodeAt(i);
        if (d >= 0x30 && d <= 0x39) {
          i++;
        } else if (d === 0x2e || d === 0x65 || d === 0x45 || d === 0x2b || d === 0x2d) {
          integer = false; // . e E + -
          i++;
        } else {
          break;
        }
      }
      // 2^53 has 16 digits; shorter literals are always safe.
      if (integer && i - start >= 16) {
        const big = BigInt(text.slice(start, i));
        if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(Number.MIN_SAFE_INTEGER)) {
          found.push([start, i]);
        }
      }
    } else {
      i++;
    }
  }
  return found;
}

function nonce(): string {
  return `\u0001orthoflow-bigint-${Math.random().toString(36).slice(2)}:`;
}

/** How {@link parseJson} treats integers outside the safe JS range. */
export type UnsafeIntegers = 'bigint' | 'error' | 'number';

/**
 * `JSON.parse` with control over unsafe integers: `'bigint'` returns them as
 * `bigint`s, `'error'` throws a `RangeError`, `'number'` rounds them.
 */
export function parseJson(text: string, mode: UnsafeIntegers): unknown {
  if (mode === 'number') {
    return JSON.parse(text);
  }
  const unsafe = unsafeIntegers(text);
  if (unsafe.length === 0) {
    return JSON.parse(text);
  }
  if (mode === 'error') {
    const [s, e] = unsafe[0]!;
    throw new RangeError(
      `orthoflow: the result contains the integer ${text.slice(s, e)}, which is not exactly representable ` +
        "as a JS number (IDs above 2^53); use unsafeIntegers: 'bigint' or layoutJson()",
    );
  }
  const marker = nonce();
  const markerJson = JSON.stringify(marker).slice(1, -1);
  let out = '';
  let last = 0;
  for (const [s, e] of unsafe) {
    out += text.slice(last, s) + '"' + markerJson + text.slice(s, e) + '"';
    last = e;
  }
  out += text.slice(last);
  return JSON.parse(out, (_key, value: unknown) =>
    typeof value === 'string' && value.startsWith(marker) ? BigInt(value.slice(marker.length)) : value,
  );
}

/** `JSON.stringify` that writes `bigint` values as exact JSON integers. */
export function stringifyJson(value: unknown): string {
  let marker: string | undefined;
  const text = JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'bigint') {
      marker ??= nonce();
      return marker + v.toString();
    }
    return v;
  });
  if (text === undefined) {
    throw new TypeError('orthoflow: the graph is not JSON-serializable');
  }
  if (marker === undefined) {
    return text;
  }
  const quoted = JSON.stringify(marker).slice(1, -1);
  const re = new RegExp('"' + quoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(-?\\d+)"', 'g');
  return text.replace(re, '$1');
}
