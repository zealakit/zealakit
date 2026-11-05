import { ExitCode, printInfo } from "@zealakit/core";
import {
  detectGoEnvironment,
  type GoEnvironmentReport,
  type ToolchainStatus,
} from "@zealakit/ecosystem-go";
import pc from "picocolors";
import { readKitManifest } from "./manifest.js";

export type DoctorOptions = {
  json?: boolean;
  /** Optional minimum Go version (e.g. `1.22.0`). */
  minGoVersion?: string;
};

type RuntimeReport = {
  runtime: "node";
  status: ToolchainStatus;
  version: string;
  minimumVersion?: string;
  message: string;
};

export type DoctorReport = {
  zealakit: {
    name: string;
    version: string;
  };
  node: RuntimeReport;
  go: GoEnvironmentReport;
};

function parseNodeMajor(version: string): number | undefined {
  const match = /^v?(\d+)/.exec(version.trim());
  return match ? Number(match[1]) : undefined;
}

function parseEnginesNodeMinimum(enginesNode: string | undefined): number | undefined {
  if (!enginesNode) return undefined;
  const match = />?=?\s*v?(\d+)/.exec(enginesNode);
  return match ? Number(match[1]) : undefined;
}

function checkNodeRuntime(): RuntimeReport {
  const manifest = readKitManifest();
  const version = process.version;
  const minimumRaw = manifest.engines?.node;
  const installedMajor = parseNodeMajor(version);
  const minimumMajor = parseEnginesNodeMinimum(minimumRaw);

  if (installedMajor === undefined) {
    return {
      runtime: "node",
      status: "error",
      version,
      minimumVersion: minimumRaw,
      message: `Could not parse Node.js version '${version}'.`,
    };
  }

  if (minimumMajor !== undefined && installedMajor < minimumMajor) {
    return {
      runtime: "node",
      status: "incompatible",
      version,
      minimumVersion: minimumRaw,
      message: `Node.js ${version} does not satisfy engines.node '${minimumRaw}'.`,
    };
  }

  return {
    runtime: "node",
    status: "ready",
    version,
    minimumVersion: minimumRaw,
    message: "Node.js runtime is ready.",
  };
}

function statusLabel(status: ToolchainStatus): string {
  switch (status) {
    case "ready":
      return pc.green("Ready");
    case "missing":
      return pc.yellow("Missing");
    case "incompatible":
      return pc.yellow("Incompatible");
    case "error":
      return pc.red("Error");
  }
}

function field(label: string, value: string): string {
  return `  ${pc.dim(label.padEnd(14))}${value}`;
}

function formatDoctorHuman(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(pc.bold("Zealakit Environment Check"));
  lines.push("");
  lines.push(pc.bold("Zealakit"));
  lines.push(field("Name:", report.zealakit.name));
  lines.push(field("Version:", report.zealakit.version));
  lines.push("");
  lines.push(pc.bold("Node.js Runtime"));
  lines.push(field("Status:", statusLabel(report.node.status)));
  lines.push(field("Version:", report.node.version));
  if (report.node.minimumVersion) {
    lines.push(field("Required:", report.node.minimumVersion));
  }
  lines.push("");
  lines.push(pc.bold("Go Environment"));
  lines.push(field("Status:", statusLabel(report.go.status)));
  lines.push(field("Version:", report.go.versionLabel ?? report.go.version ?? "Not detected"));
  if (report.go.minimumVersion) {
    lines.push(field("Required:", `>= ${report.go.minimumVersion}`));
  }
  if (report.go.executablePath) {
    lines.push(field("Executable:", report.go.executablePath));
  }
  if (report.go.goroot) lines.push(field("GOROOT:", report.go.goroot));
  if (report.go.gopath) lines.push(field("GOPATH:", report.go.gopath));
  if (report.go.gomodcache) lines.push(field("GOMODCACHE:", report.go.gomodcache));
  if (report.go.goos) lines.push(field("GOOS:", report.go.goos));
  if (report.go.goarch) lines.push(field("GOARCH:", report.go.goarch));
  lines.push("");
  lines.push(report.go.message);
  return lines.join("\n");
}

export async function buildDoctorReport(options: DoctorOptions = {}): Promise<DoctorReport> {
  const manifest = readKitManifest();
  const node = checkNodeRuntime();
  const go = await detectGoEnvironment({
    minimumVersion: options.minGoVersion,
  });
  return {
    zealakit: { name: manifest.name, version: manifest.version },
    node,
    go,
  };
}

/**
 * Exit codes:
 * - 0 when Zealakit/Node is usable and Go is ready or missing (Go is optional)
 * - 3 when Node is incompatible, or when `--min-go-version` was set and Go is not ready
 * - 1 when Node or Go detection hit an unexpected error
 */
export function doctorExitCode(report: DoctorReport, options: DoctorOptions = {}): ExitCode {
  if (report.node.status === "error" || report.go.status === "error") {
    return ExitCode.INTERNAL;
  }
  if (report.node.status === "incompatible") {
    return ExitCode.VALIDATION;
  }
  if (options.minGoVersion && report.go.status !== "ready") {
    return ExitCode.VALIDATION;
  }
  return ExitCode.OK;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const report = await buildDoctorReport(options);
  if (options.json) {
    printInfo(JSON.stringify(report, null, 2));
  } else {
    printInfo(formatDoctorHuman(report));
  }
  process.exit(doctorExitCode(report, options));
}
