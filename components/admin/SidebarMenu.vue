<!--
  components/admin/SidebarMenu.vue
  LNB(좌측 사이드바) — 5 그룹 × 17 메뉴.
  handoff_noti_admin 디자인 톤 (256px wide, 흰 배경, 그룹 헤더 + 자식 들여쓰기).
-->
<script setup lang="ts">
import {
  Home,
  CircleHelp,
  BellRing,
  MessageSquareText,
  ClipboardCheck,
  Bookmark,
  FileText,
  Image as ImageIcon,
  Tag,
  DollarSign,
  TrendingUp,
  PieChart,
  Sparkles,
  ShieldCheck,
  Database,
  Link as LinkIcon,
  Users,
  ClipboardList,
  Code2,
  Bot,
  Search,
  ChevronDown,
  MessageSquareDot,
} from "lucide-vue-next";

const ICONS: Record<string, any> = {
  home: Home,
  "circle-help": CircleHelp,
  "bell-ring": BellRing,
  "message-square-text": MessageSquareText,
  "clipboard-check": ClipboardCheck,
  bookmark: Bookmark,
  "file-text": FileText,
  image: ImageIcon,
  tag: Tag,
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  "pie-chart": PieChart,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  database: Database,
  link: LinkIcon,
  users: Users,
  "clipboard-list": ClipboardList,
  "code-2": Code2,
  bot: Bot,
};

const route = useRoute();
const authUser = useAuthUser();
const currentRole = computed<Role>(() => (authUser.value ? roleOf(authUser.value.level) : "agent"));
const menu = computed(() => useAdminMenu(currentRole.value).value);
const badges = useAdminBadges();

// 그룹 접기 상태 (localStorage 저장)
const collapsed = useState<Record<string, boolean>>("admin-menu-collapsed", () => ({}));
function toggleGroup(key: string) {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
}

const search = ref("");
const filteredMenu = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return menu.value;
  return menu.value
    .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length > 0);
});

function isActive(path: string): boolean {
  if (path === "/") return route.path === "/";
  return route.path === path || route.path.startsWith(path + "/");
}
</script>

<template>
  <aside
    class="sticky top-0 z-20 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white"
  >
    <!-- 브랜드 헤더 -->
    <div class="flex h-16 items-center gap-2.5 border-b border-slate-100 px-4">
      <span
        class="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm shadow-primary-500/30"
      >
        <MessageSquareDot class="size-4" :stroke-width="2.25" />
      </span>
      <span class="flex items-baseline gap-1 leading-none">
        <span class="text-[15px] font-bold text-slate-900">맑은</span>
        <span class="text-[15px] font-normal text-slate-600">도우미</span>
        <span class="ml-0.5 text-[12px] font-bold tracking-tight text-primary-700">Admin</span>
      </span>
    </div>

    <!-- 검색 -->
    <div class="px-3 pb-2 pt-3">
      <div class="relative">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          v-model="search"
          placeholder="메뉴 검색"
          class="h-9 w-full rounded-md bg-slate-50 pl-8 pr-12 text-sm ring-1 ring-inset ring-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>

    <!-- 메뉴 트리 -->
    <nav class="scroll-thin flex-1 space-y-0.5 overflow-auto px-3 pb-6 pt-1">
      <div v-for="group in filteredMenu" :key="group.key">
        <!-- 그룹 헤더 -->
        <button
          type="button"
          class="group flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          @click="toggleGroup(group.key)"
        >
          <span class="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {{ group.label }}
          </span>
          <ChevronDown
            class="size-4 text-slate-400 transition-transform"
            :class="collapsed[group.key] && '-rotate-90'"
          />
        </button>

        <!-- 그룹 아이템 -->
        <div v-show="!collapsed[group.key]" class="mb-1.5 mt-0.5 space-y-0.5">
          <template v-for="item in group.items" :key="item.key">
            <a
              v-if="item.external"
              :href="item.path"
              target="_blank"
              rel="noopener"
              class="group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <component :is="ICONS[item.icon]" class="size-4 shrink-0 text-slate-400" />
              <span class="flex-1 truncate">{{ item.label }}</span>
              <span class="text-[10px] text-slate-400">↗</span>
            </a>
            <NuxtLink
              v-else
              :to="item.path"
              class="group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors"
              :class="[
                isActive(item.path)
                  ? 'bg-primary-50 font-semibold text-primary-700'
                  : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ]"
            >
              <component
                :is="ICONS[item.icon]"
                class="size-4 shrink-0"
                :class="isActive(item.path) ? 'text-primary-600' : 'text-slate-400'"
              />
              <span class="flex-1 truncate">{{ item.label }}</span>
              <UBadge
                v-if="badges[item.key]"
                :color="badges[item.key].color === 'error' ? 'error' : badges[item.key].color === 'warning' ? 'warning' : 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ badges[item.key].value }}
              </UBadge>
            </NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <!-- 사용자 칩 -->
    <div v-if="authUser" class="border-t border-slate-100 px-3 py-3">
      <div class="flex items-center gap-2.5 rounded-md bg-slate-50 px-2.5 py-2">
        <span
          class="inline-flex size-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700"
        >
          {{ (authUser.name || authUser.loginId).slice(0, 2) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[12px] font-semibold text-slate-900">{{ authUser.name || authUser.loginId }}</p>
          <p class="truncate text-[10px] text-slate-500">
            <span class="font-mono">{{ currentRole }}</span>
            · {{ authUser.email || authUser.loginId }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
