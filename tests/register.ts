import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { registerPythonEcosystem } from "@zealakit/ecosystem-python";

/** Ensure core catalogs + manifest adapters are available for in-process tests. */
registerNodeEcosystem();
registerPythonEcosystem();
registerGoEcosystem();
