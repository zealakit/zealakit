<script lang="ts">
  import "@/configs/i18n.svelte";
  import "../styles/globals.css";

  let { children } = $props();
</script>

{@render children()}
