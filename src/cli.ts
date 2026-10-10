import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface RunOptions {
  cli?: string;
  execute?: (
    file: string,
    args: string[],
    options: {
      encoding: "utf-8";
      timeout: number;
      stdio: ["ignore", "pipe", "pipe"];
    }
  ) => string;
}

const DEFAULT_CLI_PATHS = [
  "/usr/local/bin/displaybuddy",
  "/opt/homebrew/bin/displaybuddy",
];

export function resolveDisplayBuddyCli(): string {
  if (process.env.DISPLAYBUDDY_CLI) return process.env.DISPLAYBUDDY_CLI;
  return DEFAULT_CLI_PATHS.find((path) => existsSync(path)) ?? "displaybuddy";
}

function isLegacyEnvelope(value: unknown): value is CommandResult {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "success" in value &&
    typeof value.success === "boolean"
  );
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf-8");
  return "";
}

function parseError(error: unknown): CommandResult {
  const details =
    typeof error === "object" && error !== null
      ? (error as {
          code?: unknown;
          stdout?: unknown;
          stderr?: unknown;
          message?: unknown;
        })
      : {};
  const output = [asText(details.stdout), asText(details.stderr)]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (details.code === "ENOENT") {
    return {
      success: false,
      error:
        "DisplayBuddy CLI not found. Install it from DisplayBuddy > Settings > General > Install CLI Tool, or set DISPLAYBUDDY_CLI.",
    };
  }

  if (output.toLowerCase().includes("not running")) {
    return {
      success: false,
      error: "DisplayBuddy is not running. Please start DisplayBuddy first.",
    };
  }

  try {
    const parsed: unknown = JSON.parse(output);
    if (isLegacyEnvelope(parsed)) return parsed;
    return { success: false, error: JSON.stringify(parsed) };
  } catch {
    const message = typeof details.message === "string" ? details.message : "Unknown error";
    return {
      success: false,
      error: output.replace(/^Error:\s*/i, "") || message,
    };
  }
}

export function runDisplayBuddy(args: string[], options: RunOptions = {}): CommandResult {
  const cli = options.cli ?? resolveDisplayBuddyCli();
  const execute =
    options.execute ??
    ((file, commandArgs, execOptions) => execFileSync(file, commandArgs, execOptions));

  let stdout: string;
  try {
    stdout = execute(cli, [...args, "--json"], {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error: unknown) {
    return parseError(error);
  }

  const output = stdout.trim();
  if (!output) return { success: true };

  try {
    const parsed: unknown = JSON.parse(output);
    if (isLegacyEnvelope(parsed)) return parsed;
    return { success: true, data: parsed };
  } catch {
    return { success: true, data: output };
  }
}
