<!--
  pages/login.vue — admin 로그인 페이지.
  tb_user.login_id + sha256(passwd) 통합 인증.
-->
<script setup lang="ts">
import { MessageSquareDot, LogIn } from "lucide-vue-next";

definePageMeta({ layout: false }); // 사이드바·top bar 없는 단독 페이지
useHead({ title: "로그인 · 맑은도우미 Admin" });

const route = useRoute();
const router = useRouter();

const loginId = ref("");
const password = ref("");
const pending = ref(false);
const error = ref<string | null>(null);

async function submit() {
  if (!loginId.value.trim() || !password.value) {
    error.value = "ID와 비밀번호를 입력해 주세요.";
    return;
  }
  pending.value = true;
  error.value = null;
  try {
    await login(loginId.value.trim(), password.value);
    const redirect = (route.query.redirect as string) || "/";
    await router.push(redirect);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-sm">
      <!-- 브랜드 -->
      <div class="mb-8 flex flex-col items-center">
        <span
          class="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-500/30"
        >
          <MessageSquareDot class="size-6" :stroke-width="2.25" />
        </span>
        <h1 class="mt-4 flex items-baseline gap-1.5">
          <span class="text-[20px] font-bold text-slate-900">맑은</span>
          <span class="text-[20px] font-normal text-slate-600">도우미</span>
          <span class="text-[14px] font-bold tracking-tight text-primary-700">Admin</span>
        </h1>
        <p class="mt-1.5 text-[12px] text-slate-500">사내 계정으로 로그인</p>
      </div>

      <!-- 폼 -->
      <form
        class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        @submit.prevent="submit"
      >
        <div>
          <label class="mb-1 block text-[12px] font-medium text-slate-700" for="login-id">ID</label>
          <input
            id="login-id"
            v-model="loginId"
            type="text"
            autocomplete="username"
            class="h-10 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            :disabled="pending"
          />
        </div>
        <div>
          <label class="mb-1 block text-[12px] font-medium text-slate-700" for="password">비밀번호</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="h-10 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            :disabled="pending"
          />
        </div>

        <div v-if="error" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="pending"
          class="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          <LogIn class="size-4" />
          {{ pending ? "로그인 중…" : "로그인" }}
        </button>
      </form>

      <p class="mt-6 text-center text-[11px] text-slate-400">
        맑은소프트 직원만 접근 가능 ·
        <code class="font-mono">@malgnsoft.com</code> 계정
      </p>
    </div>
  </div>
</template>
