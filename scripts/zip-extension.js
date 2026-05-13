import { createWriteStream, readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "../dist");
const outFile = join(__dirname, `../morningbrief-extension-v1.0.0.zip`);

// Read package.json version for filename
let version = "1.0.0";
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  version = pkg.version ?? "1.0.0";
} catch {}

// Simple ZIP creation using Node.js built-ins (no extra deps)
// For a proper ZIP we use the archiver package if available, otherwise remind user
async function zipDir() {
  try {
    const { default: archiver } = await import("archiver");
    const output = createWriteStream(outFile.replace("1.0.0", version));
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`✅  Extension packaged: morningbrief-extension-v${version}.zip (${archive.pointer()} bytes)`);
    });

    archive.on("error", (err) => { throw err; });
    archive.pipe(output);
    archive.directory(distDir, false);
    await archive.finalize();
  } catch {
    console.log(
      "\n📦  archiver 패키지가 없습니다. 아래 명령어로 설치 후 다시 실행하세요:\n" +
      "    npm install --save-dev archiver\n" +
      "\n또는 dist 폴더를 수동으로 ZIP으로 압축해 Chrome Web Store에 업로드하세요.\n"
    );
    process.exit(1);
  }
}

zipDir();
