<script setup lang="ts">
/** Public / marketing chrome (site). */
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { locales, locale } = useI18n();
</script>

<template>
  <div data-layout="site">
    <header>
      <nav>
        <NuxtLink :to="localePath('/')">Home</NuxtLink>
        <NuxtLink :to="localePath('/about-us')">About</NuxtLink>
        <NuxtLink :to="localePath('/feature-a')">Feature A</NuxtLink>
        <NuxtLink :to="localePath('/feature-b')">Feature B</NuxtLink>
        <NuxtLink :to="localePath('/auth/login')">Login</NuxtLink>
        <NuxtLink :to="localePath('/console')">Console</NuxtLink>
        <span aria-label="Language">
          <NuxtLink
            v-for="entry in locales"
            :key="entry.code"
            :to="switchLocalePath(entry.code)"
            :aria-current="entry.code === locale ? 'true' : undefined"
          >
            {{ entry.name }}
          </NuxtLink>
        </span>
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
