/**
 * Server/API service shapes asked in Discovery.
 * Only `rest` maps to current HTTP API templates; others fail with a clear limitation.
 */
export const SERVICE_TYPES = ["rest", "graphql", "rpc", "webhook"] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Service types that registered templates can satisfy today. */
export const SUPPORTED_SERVICE_TYPES = ["rest"] as const satisfies readonly ServiceType[];
