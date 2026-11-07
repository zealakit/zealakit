<script lang="ts">
  import FeatureShell from "@/components/feature-shell/index.svelte";
  import { ROUTES } from "@/configs/routes";
  import type { FeatureAItem } from "./types";
  import { useFeatureAFilter } from "./composables/use-feature-a-filter.svelte";

  const filter = useFeatureAFilter();

  const items: FeatureAItem[] = [
    { id: "alpha", name: "Alpha" },
    { id: "beta", name: "Beta" },
    { id: "gamma", name: "Gamma" },
  ];

  const visible = $derived(
    items.filter((item) => item.name.toLowerCase().includes(filter.normalized)),
  );

  function handleInput(event: Event): void {
    filter.setQuery((event.currentTarget as HTMLInputElement).value);
  }
</script>

<FeatureShell title="Feature A" description="A feature module rendered by a thin route file.">
  <label class="field" for="feature-a-search">Search</label>
  <input
    id="feature-a-search"
    class="field"
    value={filter.query}
    oninput={handleInput}
    placeholder="Filter items"
  />

  {#if visible.length > 0}
    <ul class="feature-list">
      {#each visible as item (item.id)}
        <li>
          <a href={ROUTES.featureADetail(item.id)}>{item.name}</a>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No items match “{filter.query}”.</p>
  {/if}
</FeatureShell>
