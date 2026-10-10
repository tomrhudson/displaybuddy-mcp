import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("exposes tools and sends UUID targets as discrete CLI arguments", async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "displaybuddy-mcp-test-"));
  const fakeCli = join(fixtureDir, "displaybuddy");
  const argsLog = join(fixtureDir, "args.json");
  await writeFile(
    fakeCli,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
writeFileSync(process.env.DISPLAYBUDDY_ARGS_LOG, JSON.stringify(args));
console.log(JSON.stringify({ target: args }));
`
  );
  await chmod(fakeCli, 0o755);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./build/index.js"],
    cwd: projectRoot,
    env: {
      ...process.env,
      DISPLAYBUDDY_CLI: fakeCli,
      DISPLAYBUDDY_ARGS_LOG: argsLog,
    },
  });
  const client = new Client({ name: "displaybuddy-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 9);

    const result = await client.callTool({
      name: "displaybuddy_get",
      arguments: { uuid: "display-uuid", property: "brightness" },
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(await readFile(argsLog, "utf-8")), [
      "get",
      "--uuid",
      "display-uuid",
      "--brightness",
      "--json",
    ]);
  } finally {
    await client.close();
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
