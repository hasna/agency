import { REGISTRY } from "@/lib/registry";
import {
  dataPath,
  dirExists,
  dbSize,
  formatBytes,
  getInstalledVersion,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const services = REGISTRY.map((pkg) => {
    const dir = dataPath(pkg.dataDir);
    const exists = dirExists(dir);
    const size = pkg.hasDb ? dbSize(dir) : 0;

    // Try to get installed version (can be slow, so we do it best-effort)
    let version: string | null = null;
    try {
      version = getInstalledVersion(pkg.npm);
    } catch {
      // skip
    }

    return {
      name: pkg.name,
      npm: pkg.npm,
      description: pkg.description,
      hasDb: pkg.hasDb,
      hasMcp: pkg.hasMcp,
      hasHttp: pkg.hasHttp,
      dataDir: pkg.dataDir,
      version,
      dbSize: formatBytes(size),
      dbSizeBytes: size,
      dataDirExists: exists,
    };
  });

  return Response.json(services);
}
