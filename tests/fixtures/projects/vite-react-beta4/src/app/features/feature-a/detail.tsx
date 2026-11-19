import { useFeatureAShell } from "./hooks/use-feature-a-shell-context";

const FeatureADetail = () => {
  const { detail, can } = useFeatureAShell();

  return (
    <div>
      <h1>Feature A detail {detail.entityId ? `#${detail.entityId}` : ""}</h1>
      {can("update") ? (
        <button type="button" onClick={() => detail.toUpdate()}>
          Edit
        </button>
      ) : null}
      <button type="button" onClick={() => detail.close()}>
        Back
      </button>
    </div>
  );
};

export default FeatureADetail;
