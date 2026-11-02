// PostToolUse hook (Write|Edit): runs Prettier and ESLint --fix on the touched file.
// Receives the hook payload as JSON on stdin.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ESLINT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const IGNORED_DIRS = ["node_modules", ".next", "out", "build", "references"];

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const payload = JSON.parse(raw || "{}");
const filePath = payload.tool_response?.filePath ?? payload.tool_input?.file_path;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (!filePath || !existsSync(filePath)) process.exit(0);

const relative = path.relative(projectDir, filePath);
const outsideProject = relative.startsWith("..") || path.isAbsolute(relative);
const inIgnoredDir = relative.split(path.sep).some((part) => IGNORED_DIRS.includes(part));
if (outsideProject || inIgnoredDir) process.exit(0);

const run = (args) =>
  spawnSync("npx", ["--no-install", ...args], {
    cwd: projectDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

// --ignore-unknown skips file types Prettier can't format (images, etc.).
run(["prettier", "--write", "--ignore-unknown", `"${filePath}"`]);

if (ESLINT_EXTENSIONS.has(path.extname(filePath))) {
  const lint = run(["eslint", "--fix", `"${filePath}"`]);
  if (lint.status !== 0) {
    // Exit 2 sends the remaining lint errors back to Claude so they get fixed.
    process.stderr.write(`ESLint found problems in ${relative}:\n${lint.stdout}${lint.stderr}`);
    process.exit(2);
  }
}
