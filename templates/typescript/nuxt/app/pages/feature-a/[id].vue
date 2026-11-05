<script setup lang="ts">
definePageMeta({
  layout: "default",
});

const route = useRoute();
</script>

<template>
  <div>
    <FeatureAShell>
      <h1>Feature A detail #{{ route.params.id }}</h1>
      <p>
        <NuxtLink to="/feature-a">Back to list</NuxtLink>
      </p>
    </FeatureAShell>
  </div>
</template>
