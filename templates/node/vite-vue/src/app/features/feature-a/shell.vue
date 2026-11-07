<script setup lang="ts">
import { FeatureShell } from "@/components/feature-shell";
import { CONSTANTS } from "@/lib/constants";
import FeatureAShellContent from "./shell-content.vue";
</script>

<template>
  <!-- Optional pattern: shared list/detail chrome. Skip FeatureShell when UI diverges — see feature-b. -->
  <FeatureShell
    :routes="{
      list: CONSTANTS.ROUTES.FEATURE_A.LIST,
      detail: CONSTANTS.ROUTES.FEATURE_A.DETAIL,
      create: CONSTANTS.ROUTES.FEATURE_A.CREATE,
      update: CONSTANTS.ROUTES.FEATURE_A.EDIT,
    }"
    :presentation="{
      filter: { mode: 'overlay', variant: 'drawer' },
      detail: { mode: 'route' },
      create: { mode: 'overlay', variant: 'modal' },
      update: { mode: 'overlay', variant: 'modal' },
    }"
    :capabilities="{
      view: true,
      create: true,
      update: true,
      delete: true,
    }"
    :titles="{
      filter: 'Filters',
      create: 'Create item',
      update: 'Update item',
    }"
  >
    <FeatureAShellContent />
  </FeatureShell>
</template>
