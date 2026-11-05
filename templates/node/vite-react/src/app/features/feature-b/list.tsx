import { Link } from "react-router";

/**
 * Feature B list — same CRUD area shape as Feature A, but **without**
 * `FeatureShell`. Prefer this when the UI does not share list/detail chrome.
 */
const FeatureBList = () => {
  return (
    <div>
      <h1>Feature B</h1>
      <p>Plain feature screens — no shared feature-shell context.</p>
      <Link to="demo-id">Open demo detail</Link>
    </div>
  );
};

export default FeatureBList;
