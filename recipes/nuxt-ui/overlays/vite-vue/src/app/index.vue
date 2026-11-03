<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <UApp>
    <Suspense>
      <RouterView />
      <template #fallback>
        <div>Loading...</div>
      </template>
    </Suspense>
  </UApp>
</template>
