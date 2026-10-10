import { execFileSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, resolve } from "node:path";

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

function isExecutable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveDisplayBuddyCli(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): string {
  if (env.DISPLAYBUDDY_CLI) return env.DISPLAYBUDDY_CLI;

  const pathEntries = env.PATH === undefined ? [] : env.PATH.split(delimiter);
  const pathMatch = pathEntries
    .map((directory) => resolve(cwd, directory || ".", "displaybuddy"))
    .find(isExecutable);
  if (pathMatch) return pathMatch;

  return DEFAULT_CLI_PATHS.find(isExecutable) ?? "displaybuddy";
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
    return {
      success: false,
      error: `DisplayBuddy CLI returned invalid JSON: ${output}`,
    };
  }
}
