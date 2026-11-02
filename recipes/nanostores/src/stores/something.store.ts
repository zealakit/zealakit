import { map } from "nanostores";

export interface SomethingState {
  count: number;
  name: string;
  isLoading: boolean;
}

const initialState: SomethingState = {
  count: 0,
  name: "Zealakit",
  isLoading: false,
};

export const $somethingStore = map<SomethingState>(initialState);

export function increaseSomething(by = 1): void {
  $somethingStore.setKey("count", $somethingStore.get().count + by);
}

export function decreaseSomething(): void {
  $somethingStore.setKey("count", $somethingStore.get().count - 1);
}

export function setSomethingName(name: string): void {
  $somethingStore.setKey("name", name);
}

export function resetSomething(): void {
  $somethingStore.set(initialState);
}
