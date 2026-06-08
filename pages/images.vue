<!--
  pages/images.vue — 이미지 카탈로그 (hp_image_asset).
  API: GET /image-assets · GET /image-assets/:id
-->
<script setup lang="ts">
import { Search, X, ExternalLink, Image as ImageIcon } from "lucide-vue-next";

useHead({ title: "이미지 카탈로그 · 맑은도우미 Admin" });

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

type Img = {
  id: number;
  srcPath: string;
  absoluteUrl: string;
  title: string;
  description: string;
  source: "inquiry" | "reply" | null;
  firstSeenPostId: number | null;
  firstSeenProjectId: number | null;
  usageCount: number;
  lastUsedAt: string | null;
  analyzedAt: string;
  llmModel: string | null;
};

const search = ref("");
const sourceFilter = ref<"" | "inquiry" | "reply">("");
const rows = ref<Img[]>([]);
const total = ref(0);
const pending = ref(true);
const error = ref<string | null>(null);
const selected = ref<Img | null>(null);

async function load() {
  pending.value = true;
  error.value = null;
  try {
    const url = new URL(`${API_BASE}/image-assets`);
    url.searchParams.set("limit", "60");
    if (search.value.trim()) url.searchParams.set("search", search.value.trim());
    if (sourceFilter.value) url.searchParams.set("source", sourceFilter.value);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { total: number; rows: Img[] };
    rows.value = data.rows;
    total.value = data.total;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
onMounted(load);

let timer: any = null;
watch(search, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 400);
});
watch(sourceFilter, load);

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <div>
    <header class="mb-6 flex items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">지식 자산</p>
        <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">이미지 카탈로그</h1>
        <p class="mt-1.5 text-[13px] text-slate-500">PMS 자산 이미지의 Vision 자동 캡션·설명 (`hp_image_asset`)</p>
      </div>
    </header>

    <!-- 필터 -->
    <section class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative max-w-md flex-1">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          placeholder="title·description 검색"
          class="h-9 w-full rounded-md bg-white pl-8 pr-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div class="flex items-center gap-1 rounded-md bg-white p-0.5 text-[12px] ring-1 ring-slate-200">
        <button v-for="opt in [
          { v: '', label: '전체' },
          { v: 'inquiry', label: '문의' },
          { v: 'reply', label: '응답' },
        ]" :key="opt.v" type="button"
          class="rounded px-3 py-1.5 transition"
          :class="sourceFilter === opt.v ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600 hover:text-slate-900'"
          @click="sourceFilter = opt.v as any"
        >{{ opt.label }}</button>
      </div>
      <span class="ml-auto text-[12px] text-slate-500">총 <span class="font-mono font-semibold tabular-nums text-slate-800">{{ total.toLocaleString() }}</span>건</span>
    </section>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">로딩 중…</div>
    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{{ error }}</div>

    <!-- 그리드 -->
    <section v-else-if="rows.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button v-for="r in rows" :key="r.id" type="button"
        class="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary-300 hover:shadow-md"
        @click="selected = r"
      >
        <div class="aspect-[4/3] overflow-hidden bg-slate-100">
          <img :src="r.absoluteUrl" :alt="r.title" class="size-full object-cover transition group-hover:scale-105" loading="lazy" />
        </div>
        <div class="p-3">
          <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
            <span class="rounded-md px-1.5 py-0.5 font-semibold" :class="r.source === 'reply' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'">{{ r.source === 'reply' ? '응답' : '문의' }}</span>
            <span class="text-slate-400">·</span>
            <span class="font-mono text-slate-500">사용 {{ r.usageCount }}회</span>
          </div>
          <p class="mt-1.5 line-clamp-1 text-[13px] font-semibold text-slate-900">{{ r.title }}</p>
          <p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">{{ r.description }}</p>
        </div>
      </button>
    </section>

    <div v-else class="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 p-10 text-center">
      <ImageIcon class="size-6 text-slate-400" />
      <p class="text-[13px] text-slate-500">조건에 맞는 이미지 없음</p>
    </div>

    <!-- 상세 모달 -->
    <Teleport v-if="selected" to="body">
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" @click="selected = null">
        <div class="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl" @click.stop>
          <button
            type="button"
            class="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-md bg-white/90 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            @click="selected = null"
          ><X class="size-4" /></button>
          <div class="flex max-h-[92vh] flex-col">
            <div class="overflow-auto bg-slate-50">
              <img :src="selected.absoluteUrl" :alt="selected.title" class="max-h-[55vh] w-full object-contain" />
            </div>
            <div class="border-t border-slate-100 p-5">
              <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                <span class="rounded-md px-1.5 py-0.5 font-semibold" :class="selected.source === 'reply' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'">{{ selected.source === 'reply' ? '응답' : '문의' }}</span>
                <span class="text-slate-400">·</span>
                <span class="font-mono text-slate-500">id #{{ selected.id }}</span>
                <span class="text-slate-400">·</span>
                <span class="font-mono text-slate-500">사용 {{ selected.usageCount }}회</span>
              </div>
              <h2 class="mt-2 text-[18px] font-bold text-slate-900">{{ selected.title }}</h2>
              <p class="mt-2 text-[13px] leading-relaxed text-slate-700">{{ selected.description }}</p>
              <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11.5px]">
                <div>
                  <dt class="text-slate-400">출처 게시물</dt>
                  <dd class="font-mono text-slate-700">post #{{ selected.firstSeenPostId ?? "—" }}</dd>
                </div>
                <div>
                  <dt class="text-slate-400">프로젝트</dt>
                  <dd class="font-mono text-slate-700">project #{{ selected.firstSeenProjectId ?? "—" }}</dd>
                </div>
                <div>
                  <dt class="text-slate-400">분석 시각</dt>
                  <dd class="font-mono text-slate-700">{{ fmtTime(selected.analyzedAt) }}</dd>
                </div>
                <div>
                  <dt class="text-slate-400">LLM</dt>
                  <dd class="font-mono text-slate-700">{{ selected.llmModel ?? "—" }}</dd>
                </div>
                <div class="col-span-2">
                  <dt class="text-slate-400">원본 경로</dt>
                  <dd class="break-all font-mono text-slate-700">{{ selected.srcPath }}</dd>
                </div>
              </dl>
              <div class="mt-4 flex justify-end gap-2">
                <a :href="selected.absoluteUrl" target="_blank" rel="noopener"
                  class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  <ExternalLink class="size-3.5" />원본 새 탭
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
