/** Background/worker processing models for Discovery. */
export const PROCESSING_MODELS = ["scheduled", "queue", "continuous", "manual"] as const;

export type ProcessingModel = (typeof PROCESSING_MODELS)[number];
