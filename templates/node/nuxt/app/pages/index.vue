<script setup lang="ts">
definePageMeta({
  layout: "default",
});
</script>

<template>
  <div>
    <h1>{{ $t("common.TEST") }}</h1>
    <p>Nuxt site home (default / site layout).</p>
    <p>{{ $t("action.CREATE.LABEL") }}</p>
  </div>
</template>
