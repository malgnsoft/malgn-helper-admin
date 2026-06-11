<!--
  components/admin/PagePlaceholder.vue
  stub 페이지 공용 — 각 페이지 구현 시 교체.
  AdminPageHeader + AdminEmptyState(Construction 아이콘)를 조합.
-->
<script setup lang="ts">
import { Construction } from 'lucide-vue-next'

defineProps<{
  title: string
  caption?: string
  description?: string
}>()
</script>

<template>
  <div>
    <AdminPageHeader :caption="caption" :title="title" :description="description" />

    <AdminEmptyState
      title="화면 준비 중"
      description="본 페이지는 ADMIN-PLAN 기획서에 정의된 화면입니다. 구현은 Week 1~5 순서에 따라 점진적으로 진행됩니다."
      min-height="min-h-[280px]"
    >
      <template #icon>
        <Construction class="size-5 text-slate-400" />
      </template>
    </AdminEmptyState>
  </div>
</template>
