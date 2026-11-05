import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";

/** Ensure core catalogs + manifest adapters are available for in-process tests. */
registerNodeEcosystem();
registerGoEcosystem();
