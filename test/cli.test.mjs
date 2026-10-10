import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveDisplayBuddyCli, runDisplayBuddy } from "../build/cli.js";

function successful(stdout, calls = []) {
  return (file, args, options) => {
    calls.push({ file, args, options });
    return stdout;
  };
}

test("wraps bare JSON objects returned by DisplayBuddy 3.9", () => {
  const result = runDisplayBuddy(["status"], {
    cli: "/fake/displaybuddy",
    execute: successful('{"displays":[]}'),
  });

  assert.deepEqual(result, { success: true, data: { displays: [] } });
});

test("wraps bare JSON arrays", () => {
  const result = runDisplayBuddy(["list"], {
    cli: "/fake/displaybuddy",
    execute: successful("[]"),
  });

  assert.deepEqual(result, { success: true, data: [] });
});

test("treats empty output from a successful mutation as success", () => {
  const result = runDisplayBuddy(["sync", "disable"], {
    cli: "/fake/displaybuddy",
    execute: successful("\n"),
  });

  assert.deepEqual(result, { success: true });
});

test("preserves legacy success envelopes", () => {
  const result = runDisplayBuddy(["status"], {
    cli: "/fake/displaybuddy",
    execute: successful('{"success":true,"data":{"legacy":true}}'),
  });

  assert.deepEqual(result, { success: true, data: { legacy: true } });
});

test("rejects malformed non-empty JSON output", () => {
  const result = runDisplayBuddy(["status"], {
    cli: "/fake/displaybuddy",
    execute: successful("truncated output"),
  });

  assert.deepEqual(result, {
    success: false,
    error: "DisplayBuddy CLI returned invalid JSON: truncated output",
  });
});

test("prefers an executable found on PATH", async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "displaybuddy-path-test-"));
  const pathCli = join(fixtureDir, "displaybuddy");
  await writeFile(pathCli, "#!/bin/sh\nexit 0\n");
  await chmod(pathCli, 0o755);

  try {
    assert.equal(resolveDisplayBuddyCli({ PATH: fixtureDir }), pathCli);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("prefers DISPLAYBUDDY_CLI over PATH", () => {
  assert.equal(
    resolveDisplayBuddyCli({
      DISPLAYBUDDY_CLI: "/explicit/displaybuddy",
      PATH: "/other/bin",
    }),
    "/explicit/displaybuddy"
  );
});

test("passes every value as one argument without invoking a shell", () => {
  const calls = [];
  const display = 'Studio Display"; touch /tmp/should-not-exist; echo "';

  runDisplayBuddy(["get", display], {
    cli: "/fake/displaybuddy",
    execute: successful("{}", calls),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "/fake/displaybuddy");
  assert.deepEqual(calls[0].args, ["get", display, "--json"]);
  assert.deepEqual(calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
});

test("maps the app-not-running error to actionable text", () => {
  const result = runDisplayBuddy(["status"], {
    cli: "/fake/displaybuddy",
    execute: () => {
      throw { stderr: "Error: DisplayBuddy is not running.\n" };
    },
  });

  assert.deepEqual(result, {
    success: false,
    error: "DisplayBuddy is not running. Please start DisplayBuddy first.",
  });
});

test("reports a missing CLI", () => {
  const result = runDisplayBuddy(["status"], {
    cli: "/missing/displaybuddy",
    execute: () => {
      throw { code: "ENOENT" };
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error, /CLI not found/);
  assert.match(result.error, /DISPLAYBUDDY_CLI/);
});

test("preserves useful plain-text CLI errors", () => {
  const result = runDisplayBuddy(["get", "missing"], {
    cli: "/fake/displaybuddy",
    execute: () => {
      throw { stderr: "Error: Display not found\n" };
    },
  });

  assert.deepEqual(result, { success: false, error: "Display not found" });
});
