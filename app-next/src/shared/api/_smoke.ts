/**
 * Throwaway tsc smoke test for the proto codegen pipeline.
 *
 * Asserts at the type level that:
 * 1. The generated Lightning service is importable and discoverable.
 * 2. uint64 / int64 fields arrive as `bigint` (not `string`, as the legacy
 *    app had to hand-patch via `[jstype = JS_STRING]`).
 *
 * This file is intentionally not imported by anything. It exists so `tsc`
 * catches regressions in the generated output. It will be deleted when a real
 * transport client lands in PR 4.
 */

import type { Channel, Lightning } from '@/gen/lnd_pb';

// The service is importable as a type. confirms protobuf-es v2 emits both
// message and service descriptors in a single file — the separate
// @connectrpc/protoc-gen-connect-es plugin is no longer required.
type _LightningMethods = keyof (typeof Lightning)['method'];
const _hasGetInfo: 'getInfo' extends _LightningMethods ? true : never = true;

// Channel.capacity is declared as `int64 capacity` in lightning.proto (no
// jstype annotation). protobuf-es v2 must emit it as `bigint`. If anyone
// reinstates a [jstype=JS_STRING] sanitization in gen.mjs (as the legacy
// app/scripts/build-protos.js did for every int64), this fails to type-check.
const _capacityIsBigint: Channel['capacity'] extends bigint ? true : never = true;

// Touch the symbols so unused-export analysis doesn't drop them.
export const __smoke = { _hasGetInfo, _capacityIsBigint };
