import assert from "node:assert/strict";
import test from "node:test";

import { runDisplayBuddy } from "../build/cli.js";

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
