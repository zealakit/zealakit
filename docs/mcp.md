# MCP server

`zealakit mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server on stdio so coding agents can plan and create projects with structured, validated calls instead of guessing CLI flags.

```bash
zealakit mcp --root ./workspace     # the only directory the agent may touch
```

Register it, for example in Claude Code (`.mcp.json`) or Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "zealakit": { "command": "npx", "args": ["-y", "zealakit", "mcp", "--root", "."] }
  }
}
```

| Tool                             | Writes?                   | What it does                                                                  |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `list_templates`, `list_recipes` | no                        | Metadata with the same filters as `zealakit info`                             |
| `recommend`                      | no                        | Discovery recommendations from questionnaire answers                          |
| `plan`                           | no                        | Files, packages, checks, blockers for a new project                           |
| `create`                         | yes                       | Needs `confirm: true`; refuses a non-empty target                             |
| `add`                            | only with `dryRun: false` | Adds recipes to a project; conflicts are reported, never overwritten silently |
| `doctor`, `outdated`             | no                        | Project health and dependency drift                                           |

Rules: every path is relative to `--root` and resolved with symlinks followed — anything that escapes is refused. stdout carries only protocol messages. The server is implemented directly on JSON-RPC/stdio (no SDK dependency) on top of `zealakit/api`.
