<!--
  components/admin/FilterBar.vue
  목록 상단 필터(검색) 바 — 라벨형 필드들 + 우측 초기화 / 조회 버튼.
  필드는 <AdminFilterField>로 슬롯에 배치한다.

  Usage:
    <AdminFilterBar @search="apply" @reset="reset">
      <AdminFilterField label="상태">
        <select v-model="draft.status" class="...">...</select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput v-model="draft.q" placeholder="이름 검색 후 Enter" @keyup.enter="apply" />
      </AdminFilterField>
    </AdminFilterBar>
-->
<script setup lang="ts">
import { RotateCcw, Search } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    /** 조회 버튼 라벨 */
    searchLabel?: string
    /** 초기화 버튼 라벨 */
    resetLabel?: string
  }>(),
  { searchLabel: '조회', resetLabel: '초기화' },
)

defineEmits<{
  search: []
  reset: []
}>()
</script>

<template>
  <section class="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
    <div class="flex flex-wrap items-end gap-x-3 gap-y-3">
      <!-- 필터 필드들 -->
      <slot />

      <!-- 우측 버튼 -->
      <div class="ml-auto flex items-center gap-1.5 self-end pb-0.5">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-primary-600 transition hover:bg-primary-50"
          @click="$emit('reset')"
        >
          <RotateCcw class="size-3.5" />{{ resetLabel }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
          @click="$emit('search')"
        >
          <Search class="size-3.5" />{{ searchLabel }}
        </button>
      </div>
    </div>
  </section>
</template>
