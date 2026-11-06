/**
 * Soft Backend/API traffic / concurrency expectation from Discovery.
 * Ranking signal only — never a hard eligibility filter.
 * "Not sure" is modeled as omitted preference (`no-preference` in the questionnaire).
 */
export const API_TRAFFIC_EXPECTATIONS = ["low", "medium", "high", "very-high"] as const;

export type ApiTrafficExpectation = (typeof API_TRAFFIC_EXPECTATIONS)[number];
