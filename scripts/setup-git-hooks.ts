#!/usr/bin/env bun

import { $ } from "bun";

await $`git config core.hooksPath .githooks`;
console.log("Git hooks configured: core.hooksPath=.githooks");
