/**
 * @file server-bundle.ts
 * @description Bundles the /server source tree as a downloadable zip so users
 * can install the companion server from within the app.
 */
import JSZip from "jszip";

import readme from "../../../server/README.md?raw";
import dockerfile from "../../../server/Dockerfile?raw";
import compose from "../../../server/docker-compose.yml?raw";
import envExample from "../../../server/.env.example?raw";
import pkg from "../../../server/package.json?raw";
import tsconfig from "../../../server/tsconfig.json?raw";
import indexTs from "../../../server/src/index.ts?raw";
import schemaSql from "../../../server/src/schema.sql?raw";

export async function buildServerBundleZip(): Promise<Blob> {
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