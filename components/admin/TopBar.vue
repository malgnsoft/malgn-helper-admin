<!--
  components/admin/TopBar.vue
  상단 64px — breadcrumb·전역 검색·환경 토글·계정 메뉴.
-->
<script setup lang="ts">
import { Search, ChevronRight, Bell, LogOut } from "lucide-vue-next";

const route = useRoute();
const menu = useAdminMenu();

const crumbs = computed(() => {
  const path = route.path;
  for (const g of menu.value) {
    for (const it of g.items) {
      if (it.path === path || (it.path !== "/" && path.startsWith(it.path))) {
        return [g.label, it.label];
      }
    }
  }
  return ["홈"];
});

const env = useState<"dev" | "prod">("admin-env", () => "prod");
</script>

<template>
  <header
    class="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-100 bg-white/95 px-6 backdrop-blur"
  >
    <!-- breadcrumb -->
    <nav class="flex items-center gap-1.5 text-[13px] text-slate-500">
      <template v-for="(c, i) in crumbs" :key="i">
        <ChevronRight v-if="i > 0" class="size-3 text-slate-300" />
        <span
          :class="
            i === crumbs.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-500'
          "
        >{{ c }}</span>
      </template>
    </nav>

    <!-- 전역 검색 -->
    <div class="ml-auto max-w-md flex-1">
      <div class="relative">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          placeholder="표준답변·자료·이미지·미커버 전체 검색"
          class="h-9 w-full rounded-md bg-slate-50 pl-8 pr-3 text-sm ring-1 ring-inset ring-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>

    <!-- 환경 토글 -->
    <div
      class="hidden items-center gap-1 rounded-md bg-slate-100 p-0.5 text-[11px] font-semibold sm:flex"
    >
      <button
        type="button"
        :class="
          env === 'dev'
            ? 'rounded bg-white px-2 py-1 text-slate-900 shadow-sm'
            : 'px-2 py-1 text-slate-500 hover:text-slate-900'
        "
        @click="env = 'dev'"
      >
        dev
      </button>
      <button
        type="button"
        :class="
          env === 'prod'
            ? 'rounded bg-white px-2 py-1 text-slate-900 shadow-sm'
            : 'px-2 py-1 text-slate-500 hover:text-slate-900'
        "
        @click="env = 'prod'"
      >
        prod
      </button>
    </div>

    <!-- 알림 -->
    <button
      type="button"
      class="relative inline-flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      title="알림"
    >
      <Bell class="size-4" />
      <span
        class="absolute right-1.5 top-1.5 inline-flex size-1.5 rounded-full bg-rose-500"
      />
    </button>

    <!-- 로그아웃 -->
    <button
      type="button"
      class="inline-flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      title="로그아웃"
    >
      <LogOut class="size-4" />
    </button>
  </header>
</template>
