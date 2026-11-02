import { Outlet } from "react-router";
import { FeatureShell, useFeatureShell } from "@/components/feature-shell";
import { CONSTANTS } from "@/lib/constants";

const FeatureAShellContent = () => {
  const { can, filter } = useFeatureShell();
  return (
    <div>
      <h1>Feature A</h1>
      {can("filter") ? (
        <button type="button" onClick={() => filter.open()}>
          {filter.title ?? "Filter"}
        </button>
      ) : null}
      <Outlet />
    </div>
  );
};

const FeatureAShell = () => {
  // Optional pattern: shared list/detail chrome. Skip FeatureShell when UI diverges — see feature-b.
  return (
    <FeatureShell
      routes={{
        list: CONSTANTS.ROUTES.FEATURE_A.LIST,
        detail: CONSTANTS.ROUTES.FEATURE_A.DETAIL,
        create: CONSTANTS.ROUTES.FEATURE_A.CREATE,
        update: CONSTANTS.ROUTES.FEATURE_A.EDIT,
      }}
      presentation={{
        filter: { mode: "overlay", variant: "drawer" },
        detail: { mode: "route" },
        create: { mode: "overlay", variant: "modal" },
        update: { mode: "overlay", variant: "modal" },
      }}
      capabilities={{
        view: true,
        create: true,
        update: true,
        delete: true,
      }}
      titles={{
        filter: "Filters",
        create: "Create item",
        update: "Update item",
      }}
    >
      <FeatureAShellContent />
    </FeatureShell>
  );
};

export default FeatureAShell;
