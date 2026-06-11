<!--
  components/admin/Segment.vue
  세그먼트 컨트롤(버튼 그룹) — 필터 · 정렬 전환에 사용.
  v-model로 현재 선택값을 바인딩.

  Usage:
    <AdminSegment
      v-model="sort"
      :options="[
        { value: 'recent', label: '최신' },
        { value: 'score_asc', label: '점수↑(취약)' },
        { value: 'score_desc', label: '점수↓(모범)' },
      ]"
    />
-->
<script setup lang="ts">
export interface SegmentOption {
  value: string | number
  label: string
}

defineProps<{
  options: SegmentOption[]
  modelValue: string | number
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-md bg-white p-0.5 text-[12px] ring-1 ring-slate-200"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="rounded px-3 py-1.5 transition"
      :class="
        modelValue === opt.value
          ? 'bg-primary-50 font-semibold text-primary-700'
          : 'text-slate-600 hover:text-slate-900'
      "
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
