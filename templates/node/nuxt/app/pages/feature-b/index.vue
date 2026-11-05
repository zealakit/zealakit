<script setup lang="ts">
definePageMeta({
  layout: "default",
});
</script>

<template>
  <div>
    <h1>Feature B list</h1>
    <p>No shared shell — mirror of feature-a without FeatureAShell.</p>
    <p>
      <NuxtLink to="/feature-b/1">Open detail #1</NuxtLink>
    </p>
  </div>
</template>
