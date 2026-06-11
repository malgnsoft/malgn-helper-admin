<!--
  components/admin/EmptyState.vue
  빈 상태 플레이스홀더 — 검색 결과 없음 · 데이터 없음 등에 사용.
  아이콘 슬롯과 actions 슬롯을 제공.

  Usage:
    // 기본
    <AdminEmptyState title="조건에 맞는 이미지 없음" />

    // 커스텀 아이콘 + 액션
    <AdminEmptyState title="표준답변 없음" description="새 표준답변을 추가하세요.">
      <template #icon><Bookmark class="size-5 text-slate-400" /></template>
      <template #actions>
        <UButton size="sm">추가하기</UButton>
      </template>
    </AdminEmptyState>
-->
<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    /** outer div의 최소 높이 클래스 (기본: min-h-[240px]) */
    minHeight?: string
  }>(),
  {
    title: '데이터 없음',
    minHeight: 'min-h-[240px]',
  },
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 p-10 text-center"
    :class="minHeight"
  >
    <!-- 아이콘 영역 -->
    <div
      class="inline-flex size-12 items-center justify-center rounded-full bg-slate-100"
    >
      <slot name="icon">
        <Inbox class="size-5 text-slate-400" />
      </slot>
    </div>

    <!-- 텍스트 -->
    <div>
      <p class="text-[13px] font-semibold text-slate-700">{{ title }}</p>
      <p v-if="description" class="mt-1 text-[12px] text-slate-500">
        {{ description }}
      </p>
    </div>

    <!-- 액션 버튼 등 -->
    <slot name="actions" />
  </div>
</template>
