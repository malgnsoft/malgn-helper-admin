<!--
  pages/index.vue — admin 홈. KPI 카드 + 최근 활동.
-->
<script setup lang="ts">
useHead({ title: "홈 · 맑은도우미 Admin" });

// 데모 KPI — 추후 GET /admin/badges + /admin/kpi 연동
const kpis = [
  { label: "자료", value: "142건", sub: "인덱싱 96%", icon: "📄", tone: "neutral" },
  { label: "표준답변", value: "87건", sub: "승인 대기 4", icon: "🔖", tone: "neutral" },
  { label: "이번 달 비용", value: "$12.45", sub: "예산 25%", icon: "💲", tone: "primary" },
  { label: "에스컬레이션", value: "3건 대기", sub: "평균 2h 처리", icon: "🔔", tone: "warn" },
];

const activities = [
  { time: "09:14", text: "표준답변 #88 등록", who: "장지혜", topic: "service · pricing · sms" },
  { time: "09:02", text: "자료 인덱싱 완료 — manual-v2.3.pdf", who: "system", topic: "32 청크" },
  { time: "08:51", text: "에스컬레이션 해결 — 비밀번호 변경", who: "김현희", topic: "lms-general" },
  { time: "08:30", text: "이미지 자동 캡션 9건 추가", who: "system", topic: "post #149694" },
];
</script>

<template>
  <div>
    <header class="mb-6">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">DASHBOARD</p>
      <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">홈</h1>
      <p class="mt-1.5 text-[13px] text-slate-500">시스템 현황과 최근 활동을 한눈에 봅니다.</p>
    </header>

    <!-- KPI 4 -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="k in kpis"
        :key="k.label"
        class="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <span>{{ k.icon }}</span>
          <span>{{ k.label }}</span>
        </div>
        <p
          class="mt-2 text-[22px] font-bold tabular-nums"
          :class="
            k.tone === 'primary'
              ? 'text-primary-600'
              : k.tone === 'warn'
                ? 'text-amber-700'
                : 'text-slate-900'
          "
        >
          {{ k.value }}
        </p>
        <p class="mt-0.5 text-[11px] text-slate-500">{{ k.sub }}</p>
      </div>
    </section>

    <!-- 최근 활동 -->
    <section class="mt-8 rounded-xl border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-[13px] font-semibold text-slate-900">📜 최근 활동</h2>
      </header>
      <ol class="divide-y divide-slate-100">
        <li v-for="(a, i) in activities" :key="i" class="flex items-start gap-3 px-5 py-3">
          <span class="font-mono text-[11px] tabular-nums text-slate-400">{{ a.time }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-[13px] text-slate-800">{{ a.text }}</p>
            <p class="mt-0.5 text-[11px] text-slate-500">
              <span class="font-medium text-slate-700">{{ a.who }}</span>
              <span class="mx-1 text-slate-300">·</span>
              <span>{{ a.topic }}</span>
            </p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
