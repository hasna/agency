import { dbPackages, findPackage } from "@/lib/registry";
import { spawnWithTimeout, binaryExists } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { service?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body
  }

  const serviceName = body.service;

  // Check if cloud binary is available
  if (!binaryExists("cloud")) {
    return Response.json(
      { error: "cloud CLI not installed. Run: bun install -g @hasna/cloud" },
      { status: 500 }
    );
  }

  if (serviceName && serviceName !== "__all") {
    // Pull single service
    const pkg = findPackage(serviceName);
    if (!pkg) {
      return Response.json({ error: `Service "${serviceName}" not found` }, { status: 404 });
    }

    const result = await spawnWithTimeout(
      "cloud",
      ["sync", "pull", "--service", pkg.name],
      30_000
    );

    return Response.json({
      service: pkg.name,
      success: result.code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  // Pull all services with DB
  const packages = dbPackages();
  const results = await Promise.all(
    packages.map(async (pkg) => {
      try {
        const result = await spawnWithTimeout(
          "cloud",
          ["sync", "pull", "--service", pkg.name],
          30_000
        );
        return {
          service: pkg.name,
          success: result.code === 0,
          stdout: result.stdout.slice(0, 500),
          stderr: result.stderr.slice(0, 500),
        };
      } catch {
        return {
          service: pkg.name,
          success: false,
          error: "Failed to spawn sync process",
        };
      }
    })
  );

  return Response.json(results);
}
