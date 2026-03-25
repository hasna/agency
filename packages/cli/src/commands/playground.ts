import chalk from "chalk";
import { createInterface, type Interface } from "node:readline";
import { REGISTRY, type HasnaPackage } from "../../../../src/registry.js";
import { binaryExists } from "../../../../src/utils.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, any>;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

/**
 * Read a single JSON-RPC message from an MCP server's stdout.
 * MCP stdio transport: each message is a single JSON line.
 */
function readJsonRpcMessage(
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs = 10_000,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const reader = proc.stdout.getReader();
    let buffer = "";
    let done = false;

    const timer = setTimeout(() => {
      done = true;
      reader.releaseLock();
      reject(new Error("Timeout waiting for MCP server response"));
    }, timeoutMs);

    function read(): void {
      if (done) return;
      reader.read().then(({ value, done: streamDone }) => {
        if (done) return;
        if (streamDone) {
          clearTimeout(timer);
          done = true;
          reader.releaseLock();
          reject(new Error("MCP server closed stdout"));
          return;
        }

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            clearTimeout(timer);
            done = true;
            reader.releaseLock();
            resolve(msg);
            return;
          } catch {
            // Not valid JSON, skip
          }
        }

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        read();
      }).catch((err) => {
        if (!done) {
          clearTimeout(timer);
          done = true;
          reader.releaseLock();
          reject(err);
        }
      });
    }

    read();
  });
}

/**
 * Send a JSON-RPC request to the MCP server.
 */
function sendJsonRpc(
  proc: ReturnType<typeof Bun.spawn>,
  msg: JsonRpcRequest,
): void {
  const data = JSON.stringify(msg) + "\n";
  proc.stdin.write(data);
}

/**
 * Pretty-print a JSON value with indentation and colors.
 */
function prettyPrint(value: any, indent = 0): void {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) {
    console.log(pad + chalk.dim("null"));
    return;
  }

  if (typeof value === "string") {
    // Truncate very long strings
    if (value.length > 500) {
      console.log(pad + chalk.green(`"${value.slice(0, 500)}..."`));
    } else {
      console.log(pad + chalk.green(`"${value}"`));
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    console.log(pad + chalk.yellow(String(value)));
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log(pad + chalk.dim("[]"));
      return;
    }
    console.log(pad + "[");
    for (const item of value) {
      prettyPrint(item, indent + 2);
    }
    console.log(pad + "]");
    return;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      console.log(pad + chalk.dim("{}"));
      return;
    }
    console.log(pad + "{");
    for (const key of keys) {
      process.stdout.write(pad + "  " + chalk.cyan(key) + ": ");
      const v = value[key];
      if (typeof v === "object" && v !== null) {
        console.log();
        prettyPrint(v, indent + 4);
      } else if (typeof v === "string") {
        if (v.length > 200) {
          console.log(chalk.green(`"${v.slice(0, 200)}..."`));
        } else {
          console.log(chalk.green(`"${v}"`));
        }
      } else {
        console.log(chalk.yellow(String(v)));
      }
    }
    console.log(pad + "}");
  }
}

/**
 * Parse a REPL input line into tool name and arguments.
 * Format: tool_name param1=value1 param2="value with spaces" param3=123
 */
function parseToolCall(line: string): { tool: string; args: Record<string, any> } | null {
  const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!parts || parts.length === 0) return null;

  const tool = parts[0];
  const args: Record<string, any> = {};

  for (let i = 1; i < parts.length; i++) {
    const eqIdx = parts[i].indexOf("=");
    if (eqIdx === -1) continue;

    const key = parts[i].slice(0, eqIdx);
    let val: any = parts[i].slice(eqIdx + 1);

    // Strip surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    // Try to parse numbers and booleans
    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (/^\d+$/.test(val)) val = parseInt(val, 10);
    else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);

    args[key] = val;
  }

  return { tool, args };
}

function printHelp(tools: McpTool[]): void {
  console.log(chalk.bold("\nAvailable commands:\n"));
  console.log(chalk.cyan("  help") + chalk.dim("                      — show this help"));
  console.log(chalk.cyan("  tools") + chalk.dim("                     — list all available tools"));
  console.log(chalk.cyan("  describe <tool>") + chalk.dim("           — show tool schema"));
  console.log(chalk.cyan("  <tool> [key=value ...]") + chalk.dim("   — call a tool"));
  console.log(chalk.cyan("  exit / quit / Ctrl+C") + chalk.dim("     — exit playground"));
  console.log();

  if (tools.length > 0) {
    console.log(chalk.bold("Available tools:"));
    for (const t of tools) {
      console.log(chalk.cyan(`  ${t.name}`) + (t.description ? chalk.dim(` — ${t.description}`) : ""));
    }
    console.log();
  }
}

function printTools(tools: McpTool[]): void {
  if (tools.length === 0) {
    console.log(chalk.yellow("  No tools available from this MCP server."));
    return;
  }

  console.log(chalk.bold(`\n${tools.length} tools available:\n`));
  for (const t of tools) {
    console.log(chalk.cyan(`  ${t.name}`));
    if (t.description) {
      console.log(chalk.dim(`    ${t.description}`));
    }
  }
  console.log();
}

function describeTool(tools: McpTool[], name: string): void {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    console.log(chalk.red(`  Unknown tool: ${name}`));
    const matches = tools.filter((t) => t.name.includes(name));
    if (matches.length > 0) {
      console.log(chalk.dim(`  Did you mean: ${matches.map((m) => m.name).join(", ")}?`));
    }
    return;
  }

  console.log(chalk.bold(`\n${tool.name}`));
  if (tool.description) {
    console.log(chalk.dim(`  ${tool.description}`));
  }

  if (tool.inputSchema?.properties) {
    console.log(chalk.bold("\n  Parameters:"));
    const required = new Set(tool.inputSchema.required || []);
    for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
      const req = required.has(key) ? chalk.red("*") : " ";
      console.log(
        `  ${req} ${chalk.cyan(key)}` +
          chalk.dim(` (${schema.type})`) +
          (schema.description ? chalk.dim(` — ${schema.description}`) : ""),
      );
    }
  }
  console.log();
}

export function registerPlaygroundCommand(program: import("commander").Command): void {
  program
    .command("playground <service>")
    .description("Interactive MCP tool testing REPL")
    .action(async (service: string) => {
      const pkg = REGISTRY.find((r) => r.name === service);
      if (!pkg) {
        console.error(chalk.red(`Unknown service: ${service}`));
        console.error(chalk.dim(`Available: ${REGISTRY.map((r) => r.name).join(", ")}`));
        process.exit(1);
      }

      if (!pkg.bins.mcp) {
        console.error(chalk.red(`No MCP server for ${service}`));
        process.exit(1);
      }

      if (!binaryExists(pkg.bins.mcp)) {
        console.error(chalk.red(`MCP binary not found on PATH: ${pkg.bins.mcp}`));
        console.error(chalk.dim(`Install with: bun install -g ${pkg.npm}`));
        process.exit(1);
      }

      console.log(chalk.bold("agency playground") + chalk.dim(` — ${service}\n`));
      console.log(chalk.dim(`Spawning MCP server: ${pkg.bins.mcp}`));

      // Spawn the MCP server process
      const proc = Bun.spawn([pkg.bins.mcp], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      let requestId = 0;
      let tools: McpTool[] = [];
      let initialized = false;

      // Drain stderr in background to prevent blocking
      const stderrReader = proc.stderr.getReader();
      (async () => {
        try {
          while (true) {
            const { done } = await stderrReader.read();
            if (done) break;
          }
        } catch {
          // ignore
        }
      })();

      // Cleanup on exit
      function cleanup(): void {
        try {
          proc.kill();
        } catch {
          // already dead
        }
      }

      process.on("SIGINT", () => {
        cleanup();
        process.exit(0);
      });

      // Initialize MCP connection
      try {
        requestId++;
        sendJsonRpc(proc, {
          jsonrpc: "2.0",
          id: requestId,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "agency-playground", version: "0.1.0" },
          },
        });

        const initResp = await readJsonRpcMessage(proc);
        if (initResp.error) {
          console.error(chalk.red(`MCP initialize error: ${JSON.stringify(initResp.error)}`));
          cleanup();
          process.exit(1);
        }

        // Send initialized notification
        const notif = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n";
        proc.stdin.write(notif);

        initialized = true;
        console.log(chalk.green("  Connected!"));

        if (initResp.result?.serverInfo) {
          const info = initResp.result.serverInfo;
          console.log(chalk.dim(`  Server: ${info.name || service} v${info.version || "?"}`));
        }
      } catch (err: any) {
        console.error(chalk.red(`Failed to initialize MCP server: ${err.message}`));
        cleanup();
        process.exit(1);
      }

      // List tools
      try {
        requestId++;
        sendJsonRpc(proc, {
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: {},
        });

        const listResp = await readJsonRpcMessage(proc);
        if (listResp.result?.tools) {
          tools = listResp.result.tools;
          console.log(chalk.dim(`  ${tools.length} tools available`));
        }
      } catch (err: any) {
        console.log(chalk.yellow(`  Warning: could not list tools: ${err.message}`));
      }

      console.log(chalk.dim('\nType "help" for commands, "tools" to list tools, or call a tool directly.\n'));

      // Set up REPL with tab completion
      const toolNames = tools.map((t) => t.name);
      const commands = ["help", "tools", "describe", "exit", "quit"];
      const allCompletions = [...commands, ...toolNames];

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.bold(`${service}> `),
        completer: (line: string) => {
          const hits = allCompletions.filter((c) => c.startsWith(line));
          return [hits.length > 0 ? hits : allCompletions, line];
        },
      });

      rl.prompt();

      rl.on("line", async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.prompt();
          return;
        }

        if (trimmed === "exit" || trimmed === "quit") {
          cleanup();
          process.exit(0);
        }

        if (trimmed === "help") {
          printHelp(tools);
          rl.prompt();
          return;
        }

        if (trimmed === "tools") {
          printTools(tools);
          rl.prompt();
          return;
        }

        if (trimmed.startsWith("describe ")) {
          const toolName = trimmed.slice("describe ".length).trim();
          describeTool(tools, toolName);
          rl.prompt();
          return;
        }

        // Parse as tool call
        const parsed = parseToolCall(trimmed);
        if (!parsed) {
          console.log(chalk.red("  Could not parse input. Format: tool_name key=value ..."));
          rl.prompt();
          return;
        }

        // Check if tool exists
        const matchedTool = tools.find((t) => t.name === parsed.tool);
        if (!matchedTool) {
          console.log(chalk.red(`  Unknown tool: ${parsed.tool}`));
          const matches = tools.filter((t) => t.name.includes(parsed.tool));
          if (matches.length > 0) {
            console.log(chalk.dim(`  Did you mean: ${matches.map((m) => m.name).join(", ")}?`));
          }
          rl.prompt();
          return;
        }

        // Send tool call
        try {
          requestId++;
          sendJsonRpc(proc, {
            jsonrpc: "2.0",
            id: requestId,
            method: "tools/call",
            params: {
              name: parsed.tool,
              arguments: parsed.args,
            },
          });

          const resp = await readJsonRpcMessage(proc, 30_000);

          if (resp.error) {
            console.log(chalk.red(`\n  Error: ${JSON.stringify(resp.error)}`));
          } else if (resp.result) {
            console.log();

            // MCP tools/call returns { content: [...] }
            const content = resp.result.content || resp.result;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === "text") {
                  // Try to parse as JSON for pretty printing
                  try {
                    const parsed = JSON.parse(item.text);
                    prettyPrint(parsed);
                  } catch {
                    console.log(item.text);
                  }
                } else {
                  prettyPrint(item);
                }
              }
            } else {
              prettyPrint(content);
            }
          }
          console.log();
        } catch (err: any) {
          console.log(chalk.red(`\n  Request failed: ${err.message}\n`));
        }

        rl.prompt();
      });

      rl.on("close", () => {
        cleanup();
        process.exit(0);
      });
    });
}
