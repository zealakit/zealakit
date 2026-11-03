import { spawnSync } from "node:child_process";

/**
 * `pnpm test [filter...] [--unit | --scaffold] [node --test flags]`
 * Filters are test-name patterns (OR): `pnpm test next`, `pnpm test "vite-vue: nuxt-ui" mui`.
 */
const args = process.argv.slice(2);
const filters = args.filter((arg) => !arg.startsWith("-"));
const flags = args.filter((arg) => arg.startsWith("-") && arg !== "--unit" && arg !== "--scaffold");

const suite = args.includes("--unit") ? "unit" : args.includes("--scaffold") ? "scaffold" : "**";

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    ...filters.map((filter) => `--test-name-pattern=${filter}`),
    ...flags,
    `tests/${suite}/*.test.ts`,
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
