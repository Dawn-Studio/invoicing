// Wrapper around `shadcn add`: shadcn 4.x rewrites the utils import to `from "cn"` and installs
// an unrelated npm package named `cn`. This points imports back at our own `lib/utils` and
// removes that package again.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHADCN_VERSION = "4.23.0";
const UTILS_IMPORT = '"@dawnstudio/ui/lib/utils"';
const root = new URL("..", import.meta.url).pathname;

const run = (cmd, args) => {
	const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
	if (result.status !== 0) process.exit(result.status ?? 1);
};

run("pnpm", ["dlx", `shadcn@${SHADCN_VERSION}`, "add", ...process.argv.slice(2)]);

for (const dir of ["src/components", "src/hooks", "src/lib"]) {
	for (const file of readdirSync(join(root, dir), { recursive: true })) {
		if (!/\.tsx?$/.test(file)) continue;
		const path = join(root, dir, file);
		const source = readFileSync(path, "utf8");
		const fixed = source.replaceAll(/from ["']cn["']/g, `from ${UTILS_IMPORT}`);
		if (fixed !== source) writeFileSync(path, fixed);
	}
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.dependencies?.cn) run("pnpm", ["remove", "cn"]);

run("pnpm", ["exec", "biome", "check", "--write", "src"]);
