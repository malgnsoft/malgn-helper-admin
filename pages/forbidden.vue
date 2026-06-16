<!--
  pages/forbidden.vue — 권한 부족(403) 안내 페이지.
  auth.global 미들웨어가 예외 경로로 취급하는 정착지.
-->
<script setup lang="ts">
import { ShieldAlert, Home, LogIn } from "lucide-vue-next";

definePageMeta({ layout: false }); // 사이드바·top bar 없는 단독 페이지
useHead({ title: "접근 권한 없음 · 맑은도우미 Admin" });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-sm text-center">
      <!-- 아이콘 -->
      <div class="mb-6 flex flex-col items-center">
        <span
          class="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-500/30"
        >
          <ShieldAlert class="size-6" :stroke-width="2.25" />
        </span>
        <h1 class="mt-4 text-[20px] font-bold text-slate-900">접근 권한이 없습니다</h1>
        <p class="mt-2 text-[13px] leading-relaxed text-slate-500">
          이 페이지에 접근할 수 있는 권한이 없습니다.<br />
          권한이 필요하면 관리자에게 문의해 주세요.
        </p>
      </div>

      <!-- 링크 -->
      <div class="flex flex-col gap-2">
        <NuxtLink
          to="/"
          class="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 text-sm font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <Home class="size-4" />
          대시보드로 이동
        </NuxtLink>
        <NuxtLink
          to="/login"
          class="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-white text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <LogIn class="size-4" />
          다른 계정으로 로그인
        </NuxtLink>
      </div>

      <p class="mt-6 text-center text-[11px] text-slate-400">
        맑은소프트 직원만 접근 가능 ·
        <code class="font-mono">@malgnsoft.com</code> 계정
      </p>
    </div>
  </div>
</template>
