import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Counter from "./Counter.svelte";

describe("example", () => {
  it("renders and responds to user input", async () => {
    render(Counter);

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("Count: 1");
  });
});
