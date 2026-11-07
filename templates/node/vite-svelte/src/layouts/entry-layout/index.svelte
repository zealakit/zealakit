<script lang="ts">
  import { ROUTES } from "@/configs/routes";

  let { children } = $props();
</script>

<div class="entry">
  <a class="entry__brand" href={ROUTES.overview}>Zealakit</a>
  <div class="entry__card">
    {@render children()}
  </div>
</div>
