/**
 * Capabilities Discovery can match to templates/recipes that exist today.
 * Auth, queues, payments, etc. wait until recipes ship.
 */
export const CAPABILITIES = [
  "http-api",
  "web-ui",
  "database",
  "external-api",
  "background-processing",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
