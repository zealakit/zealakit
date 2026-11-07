<script lang="ts">
  import FeatureShell from "@/components/feature-shell/index.svelte";
  import { ROUTES } from "@/configs/routes";

  type Props = {
    id: string;
  };

  let { id }: Props = $props();
</script>

<FeatureShell title="Feature A detail" description="Route params stay in the thin route file.">
  <p>Item: <code>{id || "(missing id)"}</code></p>
  <a class="button-link" href={ROUTES.featureA}>Back to list</a>
</FeatureShell>
