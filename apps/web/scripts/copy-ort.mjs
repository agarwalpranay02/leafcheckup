// Copies the ONNX Runtime Web WASM build into public/ort/<version>/ so it is
// self-hosted (no CDN, CSP-friendly) and cache-busted by version.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const root0 = new URL("..", import.meta.url).pathname;
const pkgPath = join(root0, "node_modules", "onnxruntime-web", "package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const dist = join(dirname(pkgPath), "dist");
const root = new URL("..", import.meta.url).pathname;
const outRoot = join(root, "public", "ort");
const out = join(outRoot, version);

if (existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort.webgpu.min.mjs", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  cpSync(join(dist, f), join(out, f));
}
cpSync(join(root, "scripts", "inference.worker.mjs"), join(out, "worker.mjs"));
writeFileSync(join(root, "src", "lib", "model", "ort-version.ts"), `export const ORT_VERSION = "${version}";\n`);
console.log(`onnxruntime-web ${version} -> public/ort/${version}`);
