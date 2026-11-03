<script setup lang="ts">
/** Authenticated console chrome. */
const localePath = useLocalePath();
</script>

<template>
  <div data-layout="console">
    <aside>
      <NuxtLink :to="localePath('/console')">Dashboard</NuxtLink>
      <NuxtLink :to="localePath('/')">Back to site</NuxtLink>
    </aside>
    <main>
      <slot />
    </main>
  </div>
</template>
