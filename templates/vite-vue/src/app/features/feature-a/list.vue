<script setup lang="ts">
import { useFeatureAShell } from "./composables/use-feature-a-shell-context";

const { list, create, filter, can, isCommonLoading } = useFeatureAShell();
</script>

<template>
  <div>
    <h1>Feature A</h1>
    <button v-if="can('filter')" type="button" @click="filter.open()">
      {{ filter.title ?? "Filter" }}
    </button>
    <button v-if="can('create')" type="button" @click="create.open()">
      {{ create.title ?? "Create" }}
    </button>
    <p>
      Page {{ list.page }} / {{ list.limit
      }}{{ isCommonLoading ? " — loading" : "" }}
    </p>
  </div>
</template>
