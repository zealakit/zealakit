import { useFeatureAShell } from "./hooks/use-feature-a-shell-context";

const FeatureAList = () => {
  const { list, create, filter, can, isCommonLoading } = useFeatureAShell();

  return (
    <div>
      <h1>Feature A</h1>
      {can("filter") ? (
        <button type="button" onClick={() => filter.open()}>
          {filter.title ?? "Filter"}
        </button>
      ) : null}
      {can("create") ? (
        <button type="button" onClick={() => create.open()}>
          {create.title ?? "Create"}
        </button>
      ) : null}
      <p>
        Page {list.page} / {list.limit}
        {isCommonLoading ? " — loading" : ""}
      </p>
    </div>
  );
};

export default FeatureAList;
