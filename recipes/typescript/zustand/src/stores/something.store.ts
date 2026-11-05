import { create } from "zustand";

export type SomethingState = {
  count: number;
  name: string;
  isLoading: boolean;
  increase: (by?: number) => void;
  decrease: () => void;
  setName: (name: string) => void;
  reset: () => void;
};

const initialState = {
  count: 0,
  name: "Zealakit",
  isLoading: false,
};

export const useSomethingStore = create<SomethingState>()((set) => ({
  ...initialState,
  increase: (by = 1) => set((state) => ({ count: state.count + by })),
  decrease: () => set((state) => ({ count: state.count - 1 })),
  setName: (name) => set({ name }),
  reset: () => set({ ...initialState }),
}));
