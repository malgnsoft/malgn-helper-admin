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
  /** 아직 실데이터 연동 전인 목업 페이지에 '목업' 배지 표시 */
  mock?: boolean
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
        <div class="mt-1 flex items-center gap-2">
          <h1 class="text-[22px] font-bold tracking-tight text-slate-900">
            {{ title }}
          </h1>
          <span
            v-if="mock"
            class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
            title="아직 실데이터 연동 전인 목업 화면입니다"
          >
            <span class="size-1.5 rounded-full bg-amber-500" />목업
          </span>
        </div>
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
