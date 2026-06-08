<!--
  components/admin/PagePlaceholder.vue
  17개 페이지 stub 공용 — 추후 각 페이지 구현 시 교체.
-->
<script setup lang="ts">
import { Construction } from "lucide-vue-next";

defineProps<{
  title: string;
  caption?: string;
  description?: string;
}>();
</script>

<template>
  <div>
    <!-- PageHeader -->
    <header class="mb-6">
      <p v-if="caption" class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {{ caption }}
      </p>
      <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">{{ title }}</h1>
      <p v-if="description" class="mt-1.5 max-w-3xl text-[13px] text-slate-500">{{ description }}</p>
    </header>

    <!-- 준비 중 카드 -->
    <div
      class="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 p-10 text-center"
    >
      <div class="inline-flex size-12 items-center justify-center rounded-full bg-slate-100">
        <Construction class="size-5 text-slate-400" />
      </div>
      <h3 class="text-base font-semibold text-slate-700">화면 준비 중</h3>
      <p class="max-w-md text-[13px] text-slate-500">
        본 페이지는 ADMIN-PLAN 기획서에 정의된 화면입니다. 구현은 Week 1~5 순서에 따라 점진적으로 진행됩니다.
      </p>
    </div>
  </div>
</template>
