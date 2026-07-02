<template>
  <SourceDetailWorkspace :source-id="sourceId" back-url="/library" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SourceDetailWorkspace from './components/SourceDetailWorkspace.vue'

const route = useRoute()
const sourceId = computed(() => route.params.id as string)
</script>
