import { describe, expect, test } from "bun:test";
import { buildMcpEntries, mergeTomlMcpBlocks, mergeWithoutOverwrite, resolveToolConfig } from "./connect.ts";

describe("resolveToolConfig", () => {
  test("prefers an existing official config path", () => {
    const resolved = resolveToolConfig("codex", (path) => path.endsWith("/.codex/config.toml"));
    expect(resolved.path.endsWith("/.codex/config.toml")).toBe(true);
    expect(resolved.format).toBe("toml");
  });

  test("falls back to alternate existing config paths before creating a new one", () => {
    const resolved = resolveToolConfig("claude", (path) => path.endsWith("/.claude/mcp.json"));
    expect(resolved.path.endsWith("/.claude/mcp.json")).toBe(true);
    expect(resolved.format).toBe("json");
  });

  test("defaults to the preferred config path when nothing exists", () => {
    const resolved = resolveToolConfig("gemini", () => false);
    expect(resolved.path.endsWith("/.gemini/settings.json")).toBe(true);
    expect(resolved.format).toBe("json");
  });
});

describe("buildMcpEntries", () => {
  test("builds plain JSON entries for Claude and Gemini", () => {
    const entries = buildMcpEntries(["todos"], "json");
    expect(entries.todos).toEqual({
      command: "todos-mcp",
      args: [],
    });
  });

  test("builds stdio-style JSON entries for Codex JSON fallback", () => {
    const entries = buildMcpEntries(["todos"], "codex-json");
    expect(entries.todos).toEqual({
      type: "stdio",
      command: "todos-mcp",
      args: [],
      env: {},
    });
  });
});

describe("mergeWithoutOverwrite", () => {
  test("adds new JSON entries without replacing existing ones", () => {
    const result = mergeWithoutOverwrite(
      {
        todos: { command: "custom-todos-mcp", args: [] },
      },
      {
        todos: { command: "todos-mcp", args: [] },
        mementos: { command: "mementos-mcp", args: [] },
      },
    );

    expect(result.added).toEqual(["mementos"]);
    expect(result.skipped).toEqual(["todos"]);
    expect(result.merged).toEqual({
      todos: { command: "custom-todos-mcp", args: [] },
      mementos: { command: "mementos-mcp", args: [] },
    });
  });
});

describe("mergeTomlMcpBlocks", () => {
  test("appends only missing MCP server blocks to Codex TOML config", () => {
    const existing = `[mcp_servers.todos]\ncommand = "custom-todos-mcp"\nargs = []\n`;
    const result = mergeTomlMcpBlocks(existing, {
      todos: { command: "todos-mcp", args: [] },
      mementos: { command: "mementos-mcp", args: [] },
    });

    expect(result.added).toEqual(["mementos"]);
    expect(result.skipped).toEqual(["todos"]);
    expect(result.merged).toContain(`[mcp_servers.todos]\ncommand = "custom-todos-mcp"\nargs = []`);
    expect(result.merged).toContain(`[mcp_servers.mementos]\ncommand = "mementos-mcp"\nargs = []`);
  });
});
