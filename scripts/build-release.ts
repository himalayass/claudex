#!/usr/bin/env bun

import { $ } from "bun";

const targets = [
  { target: "bun-linux-x64-modern", output: "claudex-linux-x64" },
  { target: "bun-linux-arm64", output: "claudex-linux-arm64" },
  { target: "bun-darwin-x64", output: "claudex-macos-x64" },
  { target: "bun-darwin-arm64", output: "claudex-macos-arm64" },
  { target: "bun-windows-x64", output: "claudex-windows-x64.exe" },
];

await $`mkdir -p dist`;

for (const { target, output } of targets) {
  console.log(`[build] ${output} (${target})`);
  await $`bun build ./src/claudex.ts --compile --target ${target} --outfile ./dist/${output}`;
}

await $`ls -lah dist`;
