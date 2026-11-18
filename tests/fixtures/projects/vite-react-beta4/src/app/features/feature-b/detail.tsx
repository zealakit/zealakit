import { Link, useParams } from "react-router";

const FeatureBDetail = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1>Feature B detail {id ? `#${id}` : ""}</h1>
      <Link to="..">Back to list</Link>
    </div>
  );
};

export default FeatureBDetail;
