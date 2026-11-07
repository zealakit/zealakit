import { getTemplate } from "../../registry/index.js";
import type { DiscoveryResult, MatchReason, TemplateMatchResult } from "./types.js";

/**
 * Lightweight per-template match diagnostic for tests and internal tooling.
 * Not shown in the default CLI UX.
 */
export type TemplateMatchDiagnostic = {
  templateId: string;
  /** Registry ecosystem when set (`go`); Node templates may omit it. */
  ecosystem: string;
  /** True when the template was registered and evaluated by the matcher. */
  discovered: boolean;
  eligible: boolean;
  rejectionReasons: string[];
  score?: number;
  matchedRequirements: string[];
  unmetRequirements: string[];
  warnings: string[];
};

/** Alias kept for callers that prefer the candidate-oriented name. */
export type TemplateCandidateDiagnostic = TemplateMatchDiagnostic;

const POSITIVE_HINT = /match$/;
const NEGATIVE_HINT = /mismatch$|missing$|incompat$|conflict$|excludes$/;

function classifyReasons(reasons: MatchReason[]): {
  matched: string[];
  unmet: string[];
} {
  const matched: string[] = [];
  const unmet: string[] = [];
  for (const entry of reasons) {
    if (NEGATIVE_HINT.test(entry.code) || entry.code === "not-relevant") {
      unmet.push(entry.message);
    } else if (POSITIVE_HINT.test(entry.code) || entry.code === "simplicity") {
      matched.push(entry.message);
    }
  }
  return { matched, unmet };
}

export function toTemplateMatchDiagnostic(match: TemplateMatchResult): TemplateMatchDiagnostic {
  const template = getTemplate(match.templateId);
  const { matched, unmet } = classifyReasons(match.reasons);
  return {
    templateId: match.templateId,
    ecosystem: template?.ecosystem ?? "node",
    discovered: Boolean(template),
    eligible: match.compatible,
    ...(match.compatible ? { score: match.score } : {}),
    rejectionReasons: match.compatible ? [] : match.reasons.map((entry) => entry.message),
    matchedRequirements: matched,
    unmetRequirements: match.compatible ? unmet : match.reasons.map((entry) => entry.message),
    warnings: [...match.warnings],
  };
}

/** Build diagnostics for every evaluated template in a Discovery result. */
export function getTemplateMatchDiagnostics(result: DiscoveryResult): TemplateMatchDiagnostic[] {
  return result.templates.map(toTemplateMatchDiagnostic);
}
