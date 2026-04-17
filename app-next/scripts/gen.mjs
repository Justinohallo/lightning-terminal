#!/usr/bin/env node
/**
 * Download the upstream .proto files pinned in the root go.mod, copy the repo's
 * local litrpc/ protos, fix a handful of bare imports, then run `buf generate`.
 *
 * Replaces the legacy `app/scripts/build-protos.js`. Key differences:
 *   - No `[jstype = JS_STRING]` sanitization. protobuf-es emits `bigint` for
 *     int64/uint64 natively.
 *   - No `market_info` field commenting-out. Connect-ES / protobuf-es handle
 *     map<K,V> message fields cleanly.
 *   - No post-generation JS patching. protobuf-es output is modern ES modules
 *     with no webpack-specific workarounds.
 *
 * The output of `buf generate` lands in `src/gen/`. Committed in PR 3 for
 * reviewability, gitignored in PR 3.5 once the CI reproducibility check proves
 * generation is deterministic.
 */

import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { get } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_NEXT_ROOT = join(__dirname, '..');
const REPO_ROOT = join(APP_NEXT_ROOT, '..');
const PROTO_DIR = join(APP_NEXT_ROOT, 'proto');

const GO_MOD_PATH = join(REPO_ROOT, 'go.mod');

// Patterns matching Go module versions in the root go.mod. Mirrors what the
// legacy builder does — source of truth is whatever litd pins.
const VERSION_PATTERNS = {
  lnd: /^\tgithub\.com\/lightningnetwork\/lnd (v[\d.]+-beta(?:\.rc\d)?)/ms,
  loop: /^\tgithub\.com\/lightninglabs\/loop (v[\d.]+-beta)/ms,
  pool: /^\tgithub\.com\/lightninglabs\/pool (v[\d.]+-beta)/ms,
};

// Upstream proto files and their destination names under proto/.
function remoteProtoSources(versions) {
  return {
    lnd: `lightningnetwork/lnd/${versions.lnd}/lnrpc/lightning.proto`,
    loop: `lightninglabs/loop/${versions.loop}/looprpc/client.proto`,
    'swapserverrpc/server': `lightninglabs/loop/${versions.loop}/swapserverrpc/server.proto`,
    'swapserverrpc/common': `lightninglabs/loop/${versions.loop}/swapserverrpc/common.proto`,
    'swapserverrpc/reservation': `lightninglabs/loop/${versions.loop}/swapserverrpc/reservation.proto`,
    trader: `lightninglabs/pool/${versions.pool}/poolrpc/trader.proto`,
    'auctioneerrpc/auctioneer': `lightninglabs/pool/${versions.pool}/auctioneerrpc/auctioneer.proto`,
  };
}

// LiT-specific protos live in the repo at litrpc/. They're not versioned via
// go.mod — they track the checked-out lightning-terminal commit.
const LIT_PROTOS = [
  'lit-sessions',
  'lit-accounts',
  'lit-autopilot',
  'proxy',
  'firewall',
  'lit-status',
];

// Loop's swapserverrpc files use bare imports (import "common.proto") that
// assume a flat directory. Since we namespace them under swapserverrpc/,
// the imports need rewriting to match. This is the only sanitization we keep.
const IMPORT_FIXES = {
  'swapserverrpc/server.proto': [
    ['import "common.proto"', 'import "swapserverrpc/common.proto"'],
    ['import "reservation.proto"', 'import "swapserverrpc/reservation.proto"'],
  ],
};

async function main() {
  const versions = await parseGoModVersions();
  console.log('Versions pinned in root go.mod:');
  for (const [k, v] of Object.entries(versions)) console.log(`  ${k.padEnd(6)} ${v}`);

  await mkdir(PROTO_DIR, { recursive: true });

  console.log('\nDownloading upstream protos...');
  const sources = remoteProtoSources(versions);
  for (const [name, urlPath] of Object.entries(sources)) {
    const url = `https://raw.githubusercontent.com/${urlPath}`;
    const dest = join(PROTO_DIR, `${name}.proto`);
    await mkdir(dirname(dest), { recursive: true });
    console.log(`  ${name}  <-  ${url}`);
    await downloadTo(url, dest);
  }

  console.log('\nCopying local litrpc/ protos...');
  for (const name of LIT_PROTOS) {
    const src = join(REPO_ROOT, 'litrpc', `${name}.proto`);
    const dest = join(PROTO_DIR, `${name}.proto`);
    if (await exists(src)) {
      await copyFile(src, dest);
      console.log(`  ${name}  <-  litrpc/${name}.proto`);
    } else {
      console.warn(`  warn: ${src} not found, skipping`);
    }
  }

  console.log('\nRewriting bare imports...');
  for (const [rel, fixes] of Object.entries(IMPORT_FIXES)) {
    const path = join(PROTO_DIR, rel);
    let content = await readFile(path, 'utf8');
    for (const [from, to] of fixes) content = content.replace(from, to);
    await writeFile(path, content);
    console.log(`  ${rel}`);
  }

  console.log('\nRunning buf generate...');
  execSync('pnpm exec buf generate', { cwd: APP_NEXT_ROOT, stdio: 'inherit' });
  console.log('\nDone. Output in app-next/src/gen/.');
}

async function parseGoModVersions() {
  const source = await readFile(GO_MOD_PATH, 'utf8');
  const versions = {};
  for (const [name, pattern] of Object.entries(VERSION_PATTERNS)) {
    const match = source.match(pattern);
    if (!match) throw new Error(`go.mod did not match ${name} pattern: ${pattern}`);
    versions[name] = match[1];
  }
  return versions;
}

function downloadTo(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        writeFile(dest, Buffer.concat(chunks)).then(resolve, reject);
      });
    }).on('error', reject);
  });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error('\ngen.mjs failed:', err);
  process.exit(1);
});
