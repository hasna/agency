import { REGISTRY } from "@/lib/registry";
import {
  dataPath,
  dirExists,
  dbSize,
  formatBytes,
  getInstalledVersionAsync,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  // Build base info synchronously (fast fs ops)
  const base = REGISTRY.map((pkg) => {
    const dir = dataPath(pkg.dataDir);
    const exists = dirExists(dir);
    const size = pkg.hasDb ? dbSize(dir) : 0;
    return { pkg, exists, size };
  });

  // Resolve all versions concurrently with a short timeout
  const versions = await Promise.all(
    REGISTRY.map((pkg) =>
      getInstalledVersionAsync(pkg.npm).catch(() => null),
    ),
  );

  const services = base.map(({ pkg, exists, size }, i) => ({
    name: pkg.name,
    npm: pkg.npm,
    description: pkg.description,
    hasDb: pkg.hasDb,
    hasMcp: pkg.hasMcp,
    hasHttp: pkg.hasHttp,
    dataDir: pkg.dataDir,
    version: versions[i],
    dbSize: formatBytes(size),
    dbSizeBytes: size,
    dataDirExists: exists,
  }));

  return Response.json(services);
}
