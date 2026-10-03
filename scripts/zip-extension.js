import { createWriteStream, existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "../dist");
const outFile = join(__dirname, `../morningbriefing-extension-v1.0.0.zip`);

// Read package.json version for filename
let version = "1.0.0";
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  version = pkg.version ?? "1.0.0";
} catch {}

// archiver(devDependency)로 dist/를 zip — Chrome Web Store 업로드용
async function zipDir() {
  if (!existsSync(join(distDir, "manifest.json"))) {
    throw new Error(`${distDir}/manifest.json not found — run "vite build" first`);
  }
  const { ZipArchive } = await import("archiver"); // archiver v8 API
  const output = createWriteStream(outFile.replace("1.0.0", version));
  const archive = new ZipArchive({ zlib: { level: 9 } });

  const closed = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(output);
  archive.directory(distDir, false);
  await archive.finalize();
  await closed;
  console.log(`✅  Extension packaged: morningbriefing-extension-v${version}.zip (${archive.pointer()} bytes)`);
}

zipDir().catch((err) => {
  console.error("❌  Extension packaging failed:", err);
  process.exit(1);
});
