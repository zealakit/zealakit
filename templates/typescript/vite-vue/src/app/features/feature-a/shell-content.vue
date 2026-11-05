<script setup lang="ts">
import { RouterView } from "vue-router";
import { useFeatureShell } from "@/components/feature-shell";

const { can, filter } = useFeatureShell();
</script>

<template>
  <div>
    <h1>Feature A</h1>
    <button v-if="can('filter')" type="button" @click="filter.open()">
      {{ filter.title ?? "Filter" }}
    </button>
    <RouterView />
  </div>
</template>
