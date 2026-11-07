/** Set `document.title` from a reactive getter. Call during component init. */
export function useDocumentTitle(title: () => string): void {
  $effect(() => {
    document.title = title();
  });
}
