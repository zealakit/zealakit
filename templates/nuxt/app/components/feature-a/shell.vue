<script setup lang="ts">
/**
 * Optional feature chrome for feature-a (list + detail).
 * Nuxt auto-imports as <FeatureAShell>. Skip for features that diverge (see feature-b).
 */
</script>

<template>
  <section data-feature="feature-a">
    <slot />
  </section>
</template>
