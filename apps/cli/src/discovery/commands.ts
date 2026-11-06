import {
  clearDiscoveryFeedbackSessions,
  ExitCode,
  failDiagnostic,
  formatDiscoveryFeedbackStats,
  formatDiscoveryFeedbackStatus,
  getDiscoveryFeedbackStats,
  getDiscoveryFeedbackStatus,
  printInfo,
  setDiscoveryFeedbackEnabled,
} from "@zealakit/core";
import type { Command } from "commander";
import { registerDiscoveryQueryCommand } from "./query.js";

/** `zealakit discovery stats|feedback …` — offline local feedback only. */
export function registerDiscoveryCommands(program: Command): void {
  const discovery = program
    .command("discovery")
    .description(
      "Local Project Discovery feedback and stateless JSON queries (offline; no network uploads)",
    );

  registerDiscoveryQueryCommand(discovery);

  discovery
    .command("stats")
    .description("Show aggregated local Discovery feedback statistics")
    .action(() => {
      printInfo(formatDiscoveryFeedbackStats(getDiscoveryFeedbackStats()));
    });

  discovery
    .command("feedback")
    .description("Enable, disable, clear, or show local Discovery feedback settings")
    .argument("[action]", "status | enable | disable | clear (default: status)", "status")
    .action((action: string) => {
      const normalized = action.trim().toLowerCase();
      switch (normalized) {
        case "status": {
          printInfo(formatDiscoveryFeedbackStatus(getDiscoveryFeedbackStatus()));
          return;
        }
        case "enable": {
          if (!setDiscoveryFeedbackEnabled(true)) {
            failDiagnostic(
              {
                title: "Could not update feedback settings",
                reason: "Failed to write the local Discovery feedback store.",
                resolution: "Check permissions on your zealakit config directory.",
              },
              ExitCode.INTERNAL,
            );
          }
          printInfo("Local Discovery feedback enabled.");
          printInfo(formatDiscoveryFeedbackStatus(getDiscoveryFeedbackStatus()));
          return;
        }
        case "disable": {
          if (!setDiscoveryFeedbackEnabled(false)) {
            failDiagnostic(
              {
                title: "Could not update feedback settings",
                reason: "Failed to write the local Discovery feedback store.",
                resolution: "Check permissions on your zealakit config directory.",
              },
              ExitCode.INTERNAL,
            );
          }
          printInfo("Local Discovery feedback disabled. Existing stats remain readable.");
          printInfo(formatDiscoveryFeedbackStatus(getDiscoveryFeedbackStatus()));
          return;
        }
        case "clear": {
          if (!clearDiscoveryFeedbackSessions()) {
            failDiagnostic(
              {
                title: "Could not clear feedback",
                reason: "Failed to write the local Discovery feedback store.",
                resolution: "Check permissions on your zealakit config directory.",
              },
              ExitCode.INTERNAL,
            );
          }
          printInfo("Cleared local Discovery feedback sessions.");
          printInfo(formatDiscoveryFeedbackStatus(getDiscoveryFeedbackStatus()));
          return;
        }
        default:
          failDiagnostic(
            {
              title: "Unknown feedback action",
              reason: `Unsupported action '${action}'.`,
              resolution: "Use: status | enable | disable | clear",
            },
            ExitCode.USAGE,
          );
      }
    });
}
