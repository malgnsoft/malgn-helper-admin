<!--
  components/admin/PageHeader.vue
  페이지 상단 헤더 — caption · title · description + 우측 actions 슬롯.
  기존 페이지들의 반복 마크업을 공통화.

  Usage:
    <AdminPageHeader caption="운영 보드" title="미커버 질문" description="...">
      <template #actions>
        <UButton>새 항목</UButton>
      </template>
    </AdminPageHeader>
-->
<script setup lang="ts">
defineProps<{
  caption?: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="mb-6">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p
          v-if="caption"
          class="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          {{ caption }}
        </p>
        <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-1.5 text-[13px] text-slate-500">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
