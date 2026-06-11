<!--
  components/admin/FilterField.vue
  필터 바 안의 한 필드 — 상단 라벨 + 컨트롤 슬롯.
  grow 지정 시 가로로 늘어남(검색어 칸 등).

  공통 컨트롤 클래스는 useFilterClasses()(composables) 또는 페이지에서 지정.
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    /** 가로로 늘어나는 필드(검색어 등) */
    grow?: boolean
    /** 최소 너비 (기본 grow=200px / 일반=130px) */
    minWidth?: string
  }>(),
  { grow: false },
)
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :class="grow ? 'flex-1' : ''"
    :style="{ minWidth: minWidth ?? (grow ? '220px' : '130px') }"
  >
    <label class="text-[12px] font-medium text-slate-500">{{ label }}</label>
    <slot />
  </div>
</template>
