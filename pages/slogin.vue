<!--
  pages/slogin.vue — 맑은오피스 SSO 핸드오프 랜딩.
  맑은오피스가 `/slogin?ek=<sha256>&id=<email>` 으로 브라우저를 보낸다.
  ek = SHA-256(`${email}_${yyyyMMdd(KST)}_MALGNHELPER`). GET /auth/sso 가 검증 후 세션 쿠키 발급.
  성공 → 홈(또는 redirect), 실패 → 사유 표시 + 로그인 링크.
-->
<script setup lang="ts">
import { ssoLogin } from "~/composables/use-auth";

definePageMeta({ layout: false }); // 사이드바·top bar 없는 단독 페이지

const route = useRoute();
const status = ref<"pending" | "error">("pending");
const message = ref("로그인 처리 중입니다…");

onMounted(async () => {
  const ek = String(route.query.ek ?? "").trim();
  const id = String(route.query.id ?? "").trim();
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";

  if (!ek || !id) {
    status.value = "error";
    message.value = "SSO 정보(ek·id)가 없습니다. 맑은오피스에서 다시 접속해 주세요.";
    return;
  }

  try {
    await ssoLogin(ek, id);
    await navigateTo(redirect.startsWith("/") ? redirect : "/", { replace: true });
  } catch (e: any) {
    status.value = "error";
    message.value = e?.message || "SSO 로그인에 실패했습니다.";
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <div class="mb-5 flex items-center justify-center gap-2">
        <span
          class="inline-flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white"
        >
          <span class="text-sm font-bold">M</span>
        </span>
        <span class="text-[15px] font-bold text-slate-900">맑은도우미 <span class="text-primary-700">Admin</span></span>
      </div>

      <template v-if="status === 'pending'">
        <div
          class="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600"
        />
        <p class="text-sm text-slate-600">{{ message }}</p>
      </template>

      <template v-else>
        <div
          class="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600"
        >
          <span class="text-lg font-bold">!</span>
        </div>
        <p class="mb-5 text-sm text-slate-700">{{ message }}</p>
        <NuxtLink
          to="/login"
          class="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-[13px] font-semibold text-white hover:bg-primary-700"
        >
          로그인 화면으로
        </NuxtLink>
      </template>
    </div>
  </div>
</template>
