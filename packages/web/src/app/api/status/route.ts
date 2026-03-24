import { REGISTRY, PACKAGE_COUNT } from "@/lib/registry";
import { dataPath, dirExists, dbSize, formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  let totalDbSizeBytes = 0;
  let servicesWithErrors = 0;

  for (const pkg of REGISTRY) {
    if (pkg.hasDb) {
      const dir = dataPath(pkg.dataDir);
      if (dirExists(dir)) {
        totalDbSizeBytes += dbSize(dir);
      }
    }
  }

  const servicesWithDb = REGISTRY.filter((p) => p.hasDb).length;
  const servicesWithMcp = REGISTRY.filter((p) => p.hasMcp).length;
  const servicesWithHttp = REGISTRY.filter((p) => p.hasHttp).length;

  // Count services whose data dir should exist but doesn't
  for (const pkg of REGISTRY) {
    if (pkg.hasDb && !dirExists(dataPath(pkg.dataDir))) {
      servicesWithErrors++;
    }
  }

  return Response.json({
    totalServices: PACKAGE_COUNT,
    servicesWithDb,
    servicesWithMcp,
    servicesWithHttp,
    servicesWithErrors,
    totalDbSize: formatBytes(totalDbSizeBytes),
    totalDbSizeBytes,
    lastChecked: new Date().toISOString(),
  });
}
