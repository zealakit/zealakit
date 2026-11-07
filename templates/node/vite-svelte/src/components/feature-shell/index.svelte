<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    description?: string;
    children: Snippet;
  };

  let { title, description, children }: Props = $props();
</script>

<section class="feature-shell">
  <header class="feature-shell__header">
    <h1>{title}</h1>
    {#if description}
      <p>{description}</p>
    {/if}
  </header>

  {@render children()}
</section>
