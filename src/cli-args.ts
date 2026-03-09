export function hasEffortFlag(args: string[]): boolean {
  return args.some((arg) => arg === "--effort" || arg.startsWith("--effort="));
}

export function parseClaudexArgs(rawArgs: string[]): {
  claudeArgs: string[];
  safeMode: boolean;
  hasSettingsArg: boolean;
} {
  let safeMode = true;
  let hasSettingsArg = false;
  const claudeArgs: string[] = [];

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg === "--no-safe") {
      safeMode = false;
      continue;
    }
    if (arg === "--settings" || arg.startsWith("--settings=")) {
      hasSettingsArg = true;
    }
    claudeArgs.push(arg);
  }

  return { claudeArgs, safeMode, hasSettingsArg };
}
