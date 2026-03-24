import { mcpPackages } from "@/lib/registry";
import { binaryExists, spawnWithTimeout } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MCP_CHECK_TIMEOUT = 3000;

export async function GET() {
  const packages = mcpPackages();

  const results = await Promise.all(
    packages.map(async (pkg) => {
      const mcpBin = pkg.bins.mcp || `${pkg.name}-mcp`;

      if (!binaryExists(mcpBin)) {
        return {
          name: pkg.name,
          npm: pkg.npm,
          mcpBin,
          version: null,
          toolCount: null,
          status: "not_installed" as const,
          lastChecked: new Date().toISOString(),
        };
      }

      try {
        // Try --version first
        const versionResult = await spawnWithTimeout(
          mcpBin,
          ["--version"],
          MCP_CHECK_TIMEOUT
        );
        const version =
          versionResult.code === 0
            ? versionResult.stdout.trim().split("\n")[0]
            : null;

        // Try --help or list-tools to check if it's working
        const helpResult = await spawnWithTimeout(
          mcpBin,
          ["--help"],
          MCP_CHECK_TIMEOUT
        );

        // Count tools by looking for known patterns in help output
        let toolCount: number | null = null;
        const toolMatch = helpResult.stdout.match(/(\d+)\s*tools?/i);
        if (toolMatch) {
          toolCount = parseInt(toolMatch[1], 10);
        }

        const ok = helpResult.code === 0 || versionResult.code === 0;

        return {
          name: pkg.name,
          npm: pkg.npm,
          mcpBin,
          version,
          toolCount,
          status: ok ? ("ok" as const) : ("error" as const),
          error: ok ? undefined : helpResult.stderr.slice(0, 200),
          lastChecked: new Date().toISOString(),
        };
      } catch {
        return {
          name: pkg.name,
          npm: pkg.npm,
          mcpBin,
          version: null,
          toolCount: null,
          status: "error" as const,
          error: "Failed to spawn process",
          lastChecked: new Date().toISOString(),
        };
      }
    })
  );

  return Response.json(results);
}
