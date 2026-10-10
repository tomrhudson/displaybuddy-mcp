#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runDisplayBuddy as run, type CommandResult } from "./cli.js";

const server = new McpServer({
  name: "displaybuddy-mcp",
  version: "3.2.2",
});

function toolResult(result: CommandResult) {
  if (result.success) {
    return {
      content: [
        {
          type: "text" as const,
          text: result.data !== undefined ? JSON.stringify(result.data, null, 2) : "OK",
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${result.error || "Unknown error"}`,
      },
    ],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Tool: displaybuddy_status
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_status",
  "Get a quick overview of all connected displays with their current brightness, contrast, volume, and input source. Always call this first to discover display names before using other tools.",
  async () => toolResult(run(["status"]))
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_list
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_list",
  "List all connected displays with full details including UUID, type, control mode, max values, and capability flags.",
  async () => toolResult(run(["list"]))
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_get
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_get",
  "Get current properties of a specific display.",
  {
    display: z
      .string()
      .optional()
      .describe("Display name (case-insensitive). Omit if using uuid."),
    uuid: z
      .string()
      .optional()
      .describe(
        "Display UUID from displaybuddy_list. Prefer this when displays share the same name."
      ),
    property: z
      .enum(["brightness", "contrast", "volume"])
      .optional()
      .describe("Specific property to get. Omit for all properties."),
  },
  async (input) => {
    const args = ["get"];
    if (input.uuid) {
      args.push("--uuid", input.uuid);
    } else if (input.display) {
      args.push(input.display);
    } else {
      return toolResult({ success: false, error: "Specify a display name or uuid." });
    }
    if (input.property) args.push(`--${input.property}`);
    return toolResult(run(args));
  }
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_set
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_set",
  "Set display properties like brightness, contrast, volume, input source, or rotation. Can target a specific display by name or UUID, or all displays at once.",
  {
    display: z
      .string()
      .optional()
      .describe('Display name (case-insensitive). Omit if using "uuid" or "all".'),
    uuid: z
      .string()
      .optional()
      .describe(
        "Display UUID from displaybuddy_list. Prefer this when displays share the same name."
      ),
    all: z
      .boolean()
      .optional()
      .describe("Set to true to target all displays."),
    brightness: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Brightness level (0-100)."),
    contrast: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Contrast level (0-100)."),
    volume: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Volume level (0-100)."),
    input: z
      .string()
      .optional()
      .describe(
        'Input source name (hdmi1, hdmi2, displayport1, displayport2, thunderbolt, usbc, usbc2) or DDC code.'
      ),
    rotation: z
      .enum(["0", "90", "180", "270"])
      .optional()
      .describe("Display rotation in degrees."),
    xdr_brightness: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("XDR/Ultra-bright brightness for MacBook Pro (0-100)."),
  },
  async (input) => {
    const args = ["set"];
    if (input.all) {
      args.push("--all");
    } else if (input.uuid) {
      args.push("--uuid", input.uuid);
    } else if (input.display) {
      args.push(input.display);
    } else {
      return toolResult({
        success: false,
        error: 'Specify a display name, a uuid, or set "all" to true.',
      });
    }
    if (input.brightness !== undefined) args.push("--brightness", String(input.brightness));
    if (input.contrast !== undefined) args.push("--contrast", String(input.contrast));
    if (input.volume !== undefined) args.push("--volume", String(input.volume));
    if (input.input) args.push("--input", input.input);
    if (input.rotation) args.push("--rotation", input.rotation);
    if (input.xdr_brightness !== undefined)
      args.push("--xdr-brightness", String(input.xdr_brightness));
    return toolResult(run(args));
  }
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_preset_list
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_preset_list",
  "List all saved display presets.",
  async () => toolResult(run(["preset", "list"]))
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_preset_activate
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_preset_activate",
  "Activate a saved display preset by name.",
  {
    name: z.string().describe("Name of the preset to activate."),
    delay: z
      .number()
      .positive()
      .optional()
      .describe("Delay in seconds before activating the preset."),
  },
  async (input) => {
    const args = ["preset", "activate", input.name];
    if (input.delay !== undefined) args.push("--delay", String(input.delay));
    return toolResult(run(args));
  }
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_schedule_list
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_schedule_list",
  "List all display automation schedules with their trigger type, preset, and enabled status.",
  async () => toolResult(run(["schedule", "list"]))
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_schedule_toggle
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_schedule_toggle",
  "Enable or disable a display automation schedule.",
  {
    id: z.string().describe("Schedule UUID (or unique prefix)."),
    enabled: z.boolean().describe("Set to true to enable, false to disable."),
  },
  async (input) => {
    const action = input.enabled ? "enable" : "disable";
    return toolResult(run(["schedule", action, input.id]));
  }
);

// ---------------------------------------------------------------------------
// Tool: displaybuddy_sync
// ---------------------------------------------------------------------------

server.tool(
  "displaybuddy_sync",
  "Manage display sync. Sync makes all displays follow one source display's brightness, contrast, and volume. Can check status, enable with a source display, or disable.",
  {
    action: z
      .enum(["status", "enable", "disable"])
      .describe('"status" to check, "enable" to start syncing, "disable" to stop.'),
    display: z
      .string()
      .optional()
      .describe(
        'Display name to use as sync source (required for "enable" unless uuid is given).'
      ),
    uuid: z
      .string()
      .optional()
      .describe(
        "Display UUID from displaybuddy_list. Prefer this when displays share the same name."
      ),
  },
  async (input) => {
    if (input.action === "enable") {
      if (input.uuid) {
        return toolResult(run(["sync", "enable", "--uuid", input.uuid]));
      }
      if (!input.display) {
        return toolResult({
          success: false,
          error: "Display name or uuid is required when enabling sync.",
        });
      }
      return toolResult(run(["sync", "enable", input.display]));
    }
    return toolResult(run(["sync", input.action]));
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
