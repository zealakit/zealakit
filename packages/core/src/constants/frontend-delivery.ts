/**
 * Delivery / meta-framework stacks for UI templates.
 * Distinct from `UiFramework` (React/Vue/Svelte component library).
 */
export const FRONTEND_DELIVERIES = ["vite", "astro", "next", "nuxt"] as const;

export type FrontendDelivery = (typeof FRONTEND_DELIVERIES)[number];
