<script lang="ts">
  import EntryLayout from "@/layouts/entry-layout/index.svelte";

  let { children } = $props();
</script>

<EntryLayout>
  {@render children()}
</EntryLayout>
