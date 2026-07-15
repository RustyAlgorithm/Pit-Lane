/**
 * @file server-bundle.ts
 * @description Bundles the /server source tree as a downloadable zip so users
 * can install the companion server from within the app.
 */
import JSZip from "jszip";

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.text();
}

export async function buildServerBundleZip(): Promise<Blob> {
  const base = `${import.meta.env.BASE_URL || "/"}server-bundle`;
  const [readme, dockerfile, compose, envExample, pkg, tsconfig, indexTs, schemaSql] =
    await Promise.all([
      fetchText(`${base}/README.md`),
      fetchText(`${base}/Dockerfile`),
      fetchText(`${base}/docker-compose.yml`),
      fetchText(`${base}/env.example`),
      fetchText(`${base}/package.json`),
      fetchText(`${base}/tsconfig.json`),
      fetchText(`${base}/src/index.ts`),
      fetchText(`${base}/src/schema.sql`),
    ]);
  const zip = new JSZip();
  const root = zip.folder("pitlane-server")!;
  root.file("README.md", readme);
  root.file("Dockerfile", dockerfile);
  root.file("docker-compose.yml", compose);
  root.file(".env.example", envExample);
  root.file("package.json", pkg);
  root.file("tsconfig.json", tsconfig);
  const src = root.folder("src")!;
  src.file("index.ts", indexTs);
  src.file("schema.sql", schemaSql);
  return await zip.generateAsync({ type: "blob" });
}