/**
 * Capabilities Discovery can match to templates/recipes that exist today.
 * Queues, payments, etc. wait until recipes ship.
 */
export const CAPABILITIES = [
  "http-api",
  "web-ui",
  "database",
  "external-api",
  "background-processing",
  "auth",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
