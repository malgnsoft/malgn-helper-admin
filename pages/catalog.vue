<!--
  pages/catalog.vue — 토픽·서비스 카탈로그 (목업).
  표준답변 분류용 hp_topic + hp_service. 실 CRUD API /topics · /services 미구현.
-->
<script setup lang="ts">
import { Tag, Plus } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '토픽·서비스 카탈로그 · 맑은도우미 Admin' })

type Topic = { id: number; slug: string; scope: 'common' | 'service'; label: string; description: string; sortOrder: number; active: boolean }
type Service = { id: number; slug: string; name: string; note: string; sortOrder: number; active: boolean }

const SCOPE_CLS = { common: 'bg-violet-50 text-violet-700', service: 'bg-sky-50 text-sky-700' }

const MOCK_TOPICS: Topic[] = [
  { id: 1,  slug: 'login',       scope: 'common',  label: '로그인/계정',    description: 'ID/비밀번호·계정 이슈',   sortOrder: 10, active: true },
  { id: 2,  slug: 'enrollment',  scope: 'common',  label: '수강신청',       description: '과정 등록·취소',          sortOrder: 20, active: true },
  { id: 3,  slug: 'payment',     scope: 'common',  label: '결제/비용',      description: '결제·영수증·할인',        sortOrder: 30, active: true },
  { id: 4,  slug: 'refund',      scope: 'common',  label: '환불/취소',      description: '환불 정책·처리 기간',     sortOrder: 40, active: true },
  { id: 5,  slug: 'certificate', scope: 'common',  label: '수료증/자격증',   description: '발급·재발급·이수 인정',   sortOrder: 50, active: true },
  { id: 6,  slug: 'content',     scope: 'common',  label: '콘텐츠/학습',    description: '동영상·자료·진도율',      sortOrder: 60, active: true },
  { id: 7,  slug: 'schedule',    scope: 'common',  label: '일정/기간',      description: '수강 기간·연장·마감',     sortOrder: 70, active: true },
  { id: 8,  slug: 'technical',   scope: 'common',  label: '시스템 오류',    description: '접속 장애·재생 오류',     sortOrder: 80, active: true },
  { id: 9,  slug: 'step',        scope: 'service', label: 'STEP 전용',      description: 'STEP LMS 특화 문의',     sortOrder: 10, active: true },
  { id: 10, slug: 'lms-global',  scope: 'service', label: '글로벌 LMS',     description: '해외 교육 과정 문의',     sortOrder: 20, active: true },
]

const MOCK_SERVICES: Service[] = [
  { id: 1, slug: 'step',               name: 'STEP 온라인',    note: 'STEP LMS 범용',       sortOrder: 10, active: true },
  { id: 2, slug: 'lms-general',        name: '범용 LMS',       note: '일반 기업 교육',       sortOrder: 20, active: true },
  { id: 3, slug: 'lms-mixed',          name: '혼합 LMS',       note: '혼합 훈련 과정',       sortOrder: 30, active: true },
  { id: 4, slug: 'lms-private',        name: '민간 인증',      note: '민간 자격 취득 과정',   sortOrder: 40, active: true },
  { id: 5, slug: 'lms-public-security', name: '공공 보안',      note: '공공기관 보안 과정',   sortOrder: 50, active: true },
  { id: 6, slug: 'lms-global',         name: '글로벌',         note: '해외·영문 과정',       sortOrder: 60, active: true },
]

const TOPIC_COLS: TableColumn[] = [
  { key: 'slug',   label: 'slug' },
  { key: 'scope',  label: 'scope',   align: 'center' },
  { key: 'label',  label: '라벨' },
  { key: 'desc',   label: '설명' },
  { key: 'order',  label: '정렬',    align: 'right' },
  { key: 'active', label: '상태',    align: 'center' },
]

const SERVICE_COLS: TableColumn[] = [
  { key: 'slug',   label: 'slug' },
  { key: 'name',   label: '이름' },
  { key: 'note',   label: '비고' },
  { key: 'order',  label: '정렬',  align: 'right' },
  { key: 'active', label: '상태',  align: 'center' },
]

const tab = ref<'topics' | 'services'>('topics')
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="토픽·서비스 카탈로그"
      description="표준답변 분류용 topic(scope=common/service)과 service_tag(LMS 패밀리) 카탈로그를 관리합니다."
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">CRUD API 보강 예정</span>
          <button
            type="button"
            disabled
            title="API 보강 후 활성화"
            class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-400"
          >
            <Plus class="size-4" />추가
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <!-- API 안내 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-[12px] text-sky-800">
      <span class="font-semibold">안내</span>
      <span><code class="font-mono">/topics</code> · <code class="font-mono">/services</code> CRUD API 신설 후 편집·추가가 활성화됩니다. 현재는 기본 카탈로그만 표시됩니다.</span>
    </div>

    <!-- 탭 -->
    <div class="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      <button
        v-for="t in [{ value: 'topics', label: '토픽' }, { value: 'services', label: '서비스' }]"
        :key="t.value"
        type="button"
        class="rounded-md px-4 py-1.5 text-[13px] font-medium transition"
        :class="tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
        @click="tab = t.value as any"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 토픽 테이블 -->
    <AdminDataTable
      v-if="tab === 'topics'"
      :columns="TOPIC_COLS"
      :rows="MOCK_TOPICS"
      :pending="false"
      :error="null"
      empty-text="등록된 토픽이 없습니다."
    >
      <template #default="{ row }: { row: Topic }">
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-3 font-mono text-[12px] text-slate-700">{{ row.slug }}</td>
          <td class="px-3 py-3 text-center">
            <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" :class="SCOPE_CLS[row.scope]">
              {{ row.scope }}
            </span>
          </td>
          <td class="px-3 py-3 text-[13px] font-medium text-slate-800">{{ row.label }}</td>
          <td class="px-3 py-3 text-[12px] text-slate-500">{{ row.description }}</td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">{{ row.sortOrder }}</td>
          <td class="px-5 py-3 text-center">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
              {{ row.active ? '활성' : '비활성' }}
            </span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 서비스 테이블 -->
    <AdminDataTable
      v-else
      :columns="SERVICE_COLS"
      :rows="MOCK_SERVICES"
      :pending="false"
      :error="null"
      empty-text="등록된 서비스가 없습니다."
    >
      <template #default="{ row }: { row: Service }">
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-3 font-mono text-[12px] text-slate-700">{{ row.slug }}</td>
          <td class="px-3 py-3 text-[13px] font-medium text-slate-800">{{ row.name }}</td>
          <td class="px-3 py-3 text-[12px] text-slate-500">{{ row.note }}</td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">{{ row.sortOrder }}</td>
          <td class="px-5 py-3 text-center">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
              {{ row.active ? '활성' : '비활성' }}
            </span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="false"
      title="기본 카탈로그만 존재합니다"
      description="운영자 추가 항목은 API 연동 후 저장됩니다."
      class="mt-4"
    >
      <template #icon><Tag class="size-5 text-slate-400" /></template>
    </AdminEmptyState>
  </div>
</template>
