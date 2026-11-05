import { useState } from "react";

/** Interactive React island — hydrate only when needed (`client:load` / `visible` / `idle`). */
export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>
        Count: <strong>{count}</strong>
      </p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Increment
      </button>
    </div>
  );
}
