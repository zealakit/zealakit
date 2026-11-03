<script setup lang="ts">
definePageMeta({
  layout: "default",
});

const route = useRoute();
</script>

<template>
  <div>
    <h1>Feature B detail #{{ route.params.id }}</h1>
    <p>
      <NuxtLink to="/feature-b">Back to list</NuxtLink>
    </p>
  </div>
</template>
