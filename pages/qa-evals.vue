<!--
  pages/qa-evals.vue — Q&A 평가 목록.
  API: GET /admin/evals
  상세 모달: PMS의 임베드 페이지를 iframe으로 띄움 (/posts/:postId/eval).
-->
<script setup lang="ts">
import { Star, X } from "lucide-vue-next";

useHead({ title: "Q&A 평가 · 맑은도우미 Admin" });

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";
const PMS_BASE = "https://malgn-helper-pms.pages.dev";

type EvalRow = {
  id: number;
  postId: number;
  projectId: number;
  generatedAt: string;
  generator: string;
  llmModel: string | null;
  overallScore: number | null;
  overallVerdict: string | null;
  latencyMs: number | null;
  postSubject: string | null;
  projectName: string | null;
  groupName: string | null;
};

const sort = ref<"recent" | "score_asc" | "score_desc" | "latency">("recent");
const includeEmpty = ref(false);
const rows = ref<EvalRow[]>([]);
const total = ref(0);
const pending = ref(true);
const error = ref<string | null>(null);

const selectedPostId = ref<number | null>(null);

async function load() {
  pending.value = true;
  error.value = null;
  try {
    const url = new URL(`${API_BASE}/admin/evals`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("sort", sort.value);
    if (includeEmpty.value) url.searchParams.set("includeEmpty", "1");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { rows: EvalRow[]; total: number };
    rows.value = data.rows;
    total.value = data.total;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
onMounted(load);
watch([sort, includeEmpty], load);

function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function scoreClass(s: number | null) {
  if (s == null) return "text-slate-400";
  if (s >= 4) return "text-emerald-600";
  if (s >= 3) return "text-amber-600";
  return "text-rose-600";
}
</script>

<template>
  <div>
    <header class="mb-6 flex items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">운영 보드</p>
        <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">Q&A 평가</h1>
        <p class="mt-1.5 text-[13px] text-slate-500">상담사 응대를 5축으로 평가한 결과 — 행 클릭 시 PMS 평가 카드 열림</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-[12px] text-slate-600">
          <input v-model="includeEmpty" type="checkbox" class="size-3.5 rounded border-slate-300" />
          빈 결과 포함
        </label>
        <div class="flex items-center gap-1 rounded-md bg-white p-0.5 text-[12px] ring-1 ring-slate-200">
          <button v-for="opt in [
            { v: 'recent', label: '최신' },
            { v: 'score_asc', label: '점수↑(취약)' },
            { v: 'score_desc', label: '점수↓(모범)' },
            { v: 'latency', label: '지연↑' },
          ]" :key="opt.v" type="button"
            class="rounded px-3 py-1.5 transition"
            :class="sort === opt.v ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600 hover:text-slate-900'"
            @click="sort = opt.v as any"
          >{{ opt.label }}</button>
        </div>
      </div>
    </header>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">로딩 중…</div>
    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{{ error }}</div>

    <section v-else class="rounded-xl border border-slate-200 bg-white">
      <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 class="text-[13px] font-semibold text-slate-900">전체 <span class="font-mono text-slate-500">{{ total.toLocaleString() }}</span>건</h2>
        <span class="text-[11px] text-slate-400">표시 {{ rows.length }}건</span>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full text-[13px]">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-2.5 text-left font-medium">ID</th>
              <th class="px-3 py-2.5 text-left font-medium">게시글</th>
              <th class="px-3 py-2.5 text-left font-medium">프로젝트</th>
              <th class="px-3 py-2.5 text-right font-medium">점수</th>
              <th class="px-3 py-2.5 text-left font-medium">한 줄 평</th>
              <th class="px-3 py-2.5 text-right font-medium">생성</th>
              <th class="px-5 py-2.5 text-right font-medium">지연</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="r in rows" :key="r.id"
              class="cursor-pointer hover:bg-slate-50"
              @click="selectedPostId = r.postId"
            >
              <td class="px-5 py-3 font-mono text-[11px] text-slate-500">#{{ r.id }}</td>
              <td class="px-3 py-3">
                <p class="truncate text-[12.5px] font-medium text-slate-800">{{ r.postSubject || "(제목 없음)" }}</p>
                <p class="mt-0.5 font-mono text-[10.5px] text-slate-400">post #{{ r.postId }}</p>
              </td>
              <td class="px-3 py-3">
                <p class="text-[12px] text-slate-700">{{ r.projectName || "—" }}</p>
                <p v-if="r.groupName" class="mt-0.5 text-[10.5px] text-slate-400">{{ r.groupName }}</p>
              </td>
              <td class="px-3 py-3 text-right">
                <span class="inline-flex items-center gap-1 font-mono font-semibold tabular-nums" :class="scoreClass(r.overallScore)">
                  <Star v-if="r.overallScore != null" class="size-3.5 fill-current" />
                  {{ r.overallScore != null ? r.overallScore.toFixed(1) : "—" }}
                </span>
              </td>
              <td class="px-3 py-3"><p class="line-clamp-1 max-w-md text-[12px] text-slate-600">{{ r.overallVerdict || "—" }}</p></td>
              <td class="px-3 py-3 text-right font-mono text-[11px] tabular-nums text-slate-500">{{ fmtTime(r.generatedAt) }}</td>
              <td class="px-5 py-3 text-right font-mono text-[11px] tabular-nums text-slate-500">{{ r.latencyMs ?? "—" }}ms</td>
            </tr>
            <tr v-if="!rows.length"><td colspan="7" class="px-5 py-12 text-center text-[13px] text-slate-400">조건에 맞는 평가 결과 없음</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 모달 iframe — PMS 평가 카드 임베드 -->
    <Teleport v-if="selectedPostId != null" to="body">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
        @click="selectedPostId = null"
      >
        <div class="relative h-[92vh] w-full max-w-[1000px] overflow-hidden rounded-xl bg-white shadow-2xl" @click.stop>
          <button
            type="button"
            class="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-md bg-white/90 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            @click="selectedPostId = null"
          ><X class="size-4" /></button>
          <iframe
            :src="`${PMS_BASE}/posts/${selectedPostId}/eval`"
            class="size-full border-0"
            allow="clipboard-write"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
