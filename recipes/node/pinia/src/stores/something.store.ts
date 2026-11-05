import { defineStore } from "pinia";
import { ref } from "vue";

export const useSomethingStore = defineStore("something", () => {
  const count = ref(0);
  const name = ref("Zealakit");
  const isLoading = ref(false);

  function increase(by = 1): void {
    count.value += by;
  }

  function decrease(): void {
    count.value -= 1;
  }

  function setName(next: string): void {
    name.value = next;
  }

  function reset(): void {
    count.value = 0;
    name.value = "Zealakit";
    isLoading.value = false;
  }

  return {
    count,
    name,
    isLoading,
    increase,
    decrease,
    setName,
    reset,
  };
});
