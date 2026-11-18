import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";

const Counter = defineComponent({
  setup() {
    const count = ref(0);
    return () => h("button", { onClick: () => count.value++ }, `Count: ${count.value}`);
  },
});

describe("example", () => {
  it("renders and responds to user input", async () => {
    const wrapper = mount(Counter);

    await wrapper.trigger("click");

    expect(wrapper.text()).toBe("Count: 1");
  });
});
