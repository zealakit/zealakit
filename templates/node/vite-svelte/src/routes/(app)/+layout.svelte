<script lang="ts">
  import ConsoleLayout from "@/layouts/console-layout/index.svelte";

  let { children } = $props();
</script>

<ConsoleLayout>
  {@render children()}
</ConsoleLayout>
