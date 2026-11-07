/** Deployment shapes that map cleanly to current Node/Go starters. */
export const DEPLOYMENT_TARGETS = ["vps", "container", "serverless", "static-hosting"] as const;

export type DeploymentTarget = (typeof DEPLOYMENT_TARGETS)[number];
