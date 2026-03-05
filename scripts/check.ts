#!/usr/bin/env bun

import { $ } from "bun";

console.log("[check] Running TypeScript typecheck");
await $`bun run typecheck`;

console.log("[check] Running tests");
await $`bun test`;
