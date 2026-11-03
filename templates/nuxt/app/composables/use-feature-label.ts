/** Example composable — Nuxt auto-imports as `useFeatureLabel`. */
export function useFeatureLabel(name: string) {
  return computed(() => name.trim() || "untitled");
}
