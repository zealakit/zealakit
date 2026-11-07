<script lang="ts">
  import { page } from "$app/state";
  import FeatureADetail from "@/features/feature-a/detail.svelte";
</script>

<FeatureADetail id={page.params.id ?? ""} />
