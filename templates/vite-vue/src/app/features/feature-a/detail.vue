<script setup lang="ts">
import { useFeatureAShell } from "./composables/use-feature-a-shell-context";

const { detail, can } = useFeatureAShell();
</script>

<template>
  <div>
    <h1>Feature A detail {{ detail.entityId ? `#${detail.entityId}` : "" }}</h1>
    <button v-if="can('update')" type="button" @click="detail.toUpdate()">Edit</button>
    <button type="button" @click="detail.close()">Back</button>
  </div>
</template>
