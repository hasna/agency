import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { REGISTRY, mcpPackages, type HasnaPackage } from "../../../../src/registry.js";

/** Config file paths per tool */
const TOOL_CONFIGS: Record<string, { path: string; label: string }> = {
  claude: {
    path: join(homedir(), ".claude", "settings.json"),
    label: "Claude Code",
  },
  codex: {
    path: join(homedir(), ".codex", "settings.json"),
    label: "Codex CLI",
  },
  gemini: {
    path: join(homedir(), ".gemini", "settings.json"),
    label: "Gemini CLI",
  },
};

const SUPPORTED_TOOLS = Object.keys(TOOL_CONFIGS);

interface McpServerEntry {
  command: string;
  args: string[];
}

function buildMcpEntries(serviceNames: string[]): Record<string, McpServerEntry> {
  const entries: Record<string, McpServerEntry> = {};
  for (const name of serviceNames) {
    const pkg = REGISTRY.find((r) => r.name === name);
    if (!pkg?.bins?.mcp) continue;
    entries[name] = {
      command: pkg.bins.mcp,
      args: [],
    };
  }
  return entries;
}

function readJson(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function writeJson(path: string, data: Record<string, any>): void {
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function mergeWithoutOverwrite(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): { merged: Record<string, any>; added: string[]; skipped: string[] } {
  const merged = { ...existing };
  const added: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(incoming)) {
    if (key in merged) {
      skipped.push(key);
    } else {
      merged[key] = value;
      added.push(key);
    }
  }

  return { merged, added, skipped };
}

function connectTool(
  tool: string,
  mcpEntries: Record<string, McpServerEntry>,
  dryRun: boolean,
): void {
  const config = TOOL_CONFIGS[tool];
  if (!config) {
    console.error(chalk.red(`Unknown tool: ${tool}`));
    console.error(chalk.dim(`Supported tools: ${SUPPORTED_TOOLS.join(", ")}`));
    process.exit(1);
  }

  const settings = readJson(config.path);
  const existingServers = settings.mcpServers || {};

  const { merged, added, skipped } = mergeWithoutOverwrite(existingServers, mcpEntries);

  if (added.length === 0) {
    console.log(chalk.dim(`  ${config.label}: all ${Object.keys(mcpEntries).length} servers already configured`));
    if (skipped.length > 0) {
      console.log(chalk.dim(`  Skipped (already present): ${skipped.join(", ")}`));
    }
    return;
  }

  if (dryRun) {
    console.log(chalk.yellow(`  [dry-run] ${config.label}: would add ${added.length} MCP servers`));
    for (const name of added) {
      const entry = mcpEntries[name];
      console.log(chalk.dim(`    + ${name} → ${entry.command}`));
    }
    if (skipped.length > 0) {
      console.log(chalk.dim(`  Would skip (already present): ${skipped.join(", ")}`));
    }
    return;
  }

  settings.mcpServers = merged;
  writeJson(config.path, settings);

  console.log(chalk.green(`  ${config.label}: added ${added.length} MCP servers → ${config.path}`));
  for (const name of added) {
    const entry = mcpEntries[name];
    console.log(chalk.dim(`    + ${name} → ${entry.command}`));
  }
  if (skipped.length > 0) {
    console.log(chalk.dim(`  Skipped (already present): ${skipped.join(", ")}`));
  }
}

export function registerConnectCommand(program: import("commander").Command): void {
  program
    .command("connect <tool>")
    .description("Auto-wire MCP servers into AI tool configs (claude, codex, gemini)")
    .option("--only <services>", "Only connect specific services (comma-separated)")
    .option("--dry-run", "Show what would be added without writing")
    .action((tool: string, opts: { only?: string; dryRun?: boolean }) => {
      const allMcpNames = mcpPackages().map((p) => p.name);
      const serviceNames = opts.only
        ? opts.only.split(",").map((s) => s.trim()).filter(Boolean)
        : allMcpNames;

      // Validate requested service names
      const invalid = serviceNames.filter((s) => !allMcpNames.includes(s));
      if (invalid.length > 0) {
        console.error(chalk.red(`Unknown MCP services: ${invalid.join(", ")}`));
        console.error(chalk.dim(`Available: ${allMcpNames.join(", ")}`));
        process.exit(1);
      }

      const mcpEntries = buildMcpEntries(serviceNames);
      const entryCount = Object.keys(mcpEntries).length;

      if (entryCount === 0) {
        console.log(chalk.yellow("No MCP servers found for the specified services."));
        return;
      }

      console.log(
        chalk.bold("agency connect") +
          chalk.dim(` — wiring ${entryCount} MCP servers into ${TOOL_CONFIGS[tool]?.label || tool}\n`),
      );

      connectTool(tool, mcpEntries, !!opts.dryRun);

      if (!opts.dryRun) {
        console.log(chalk.bold("\nDone!") + chalk.dim(" Restart your AI tool to pick up the changes."));
      }
    });
}
