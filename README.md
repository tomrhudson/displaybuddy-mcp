# DisplayBuddy MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI agents control Mac monitors via [DisplayBuddy](https://displaybuddy.app) — adjust brightness, contrast, volume, input source, apply presets, sync displays, and more.

Works with Claude Desktop, Cursor, Windsurf, Cline, and any MCP-compatible client.

## Prerequisites

1. **macOS** with [DisplayBuddy](https://displaybuddy.app) installed and running
2. **DisplayBuddy CLI** installed: open DisplayBuddy > Settings > General > Install CLI Tool
3. **Node.js** 18+

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "displaybuddy": {
      "command": "npx",
      "args": ["-y", "displaybuddy-mcp"]
    }
  }
}
```

### Cursor

Add to your MCP settings:

```json
{
  "mcpServers": {
    "displaybuddy": {
      "command": "npx",
      "args": ["-y", "displaybuddy-mcp"]
    }
  }
}
```

### Smithery

```bash
npx -y @smithery/cli install displaybuddy-mcp --client claude
```

## Available Tools

| Tool | Description |
|------|-------------|
| `displaybuddy_status` | Quick overview of all displays (call this first) |
| `displaybuddy_list` | Full display details including UUID, type, capabilities |
| `displaybuddy_get` | Get properties of a specific display |
| `displaybuddy_set` | Set brightness, contrast, volume, input, rotation |
| `displaybuddy_preset_list` | List saved presets |
| `displaybuddy_preset_activate` | Activate a preset (with optional delay) |
| `displaybuddy_schedule_list` | List automation schedules |
| `displaybuddy_schedule_toggle` | Enable or disable a schedule |
| `displaybuddy_sync` | Check/enable/disable multi-display sync |

## Example Prompts

Once connected, you can ask your AI assistant things like:

- "Dim all my monitors to 30%"
- "What displays are connected?"
- "Switch my Dell monitor to HDMI"
- "Activate my Night Mode preset"
- "Sync all displays to my main monitor"
- "Turn up the brightness on my external display"
- "Set up my coding environment — brightness 70, contrast 60"

## How It Works

The MCP server wraps the `displaybuddy` CLI, which communicates with the running DisplayBuddy app via URL scheme. All operations are local — no data leaves your machine.

```
AI Agent → MCP Server → displaybuddy CLI → DisplayBuddy App → Your Monitors
```

## Development

```bash
npm install
npm run build

# Test with MCP Inspector
npx -y @modelcontextprotocol/inspector node ./build/index.js
```

## License

MIT
