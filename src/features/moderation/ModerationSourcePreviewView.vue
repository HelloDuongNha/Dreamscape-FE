<template>
  <SourceDetailWorkspace 
    :source-id="sourceId" 
    mode="moderation" 
    action-mode="moderation-preview" 
    back-url="/moderation/sources" 
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SourceDetailWorkspace from '@/features/library/components/SourceDetailWorkspace.vue'

const route = useRoute()
const sourceId = computed(() => route.params.id as string)
</script>
