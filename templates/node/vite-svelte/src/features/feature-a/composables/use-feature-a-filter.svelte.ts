/** Local search state for the Feature A list (Svelte 5 runes in a composable). */
export function useFeatureAFilter() {
  let query = $state("");

  return {
    get query() {
      return query;
    },
    get normalized() {
      return query.trim().toLowerCase();
    },
    setQuery(value: string) {
      query = value;
    },
  };
}
