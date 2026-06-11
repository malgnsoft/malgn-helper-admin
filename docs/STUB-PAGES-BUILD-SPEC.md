# malgn-helper-admin — Stub 페이지 빌드 스펙

> 작성: planner · 2026-06-11 · 근거: [ADMIN-PLAN.md](../../malgn-helper/docs/ADMIN-PLAN.md) + api-dev 실 라우트 보고 + 현재 레포 상태 대조.
> 대상: 현재 `AdminPagePlaceholder`로 남아 있는 **stub 페이지** (아래 §0에서 grep 확인 — 14개. team-lead 라벨 "13개"와 1 차이는 본문 §0 주석 참조).
> **표준 패턴**: 이미 완성된 `pages/cost.vue` · `pages/images.vue` · `pages/qa-evals.vue` · `pages/index.vue` 의 구조·컴포넌트·fetch 패턴을 그대로 따른다. 새 컴포넌트 발명 금지, 아래 공용 컴포넌트 우선 사용.

## 공용 컴포넌트 (components/admin/, 자동 import `Admin*`)

| 컴포넌트 | 용도 | 핵심 props/slot |
| --- | --- | --- |
| `AdminPageHeader` | 페이지 제목부 | `caption` `title` `description` + `#actions` |
| `AdminKpiCard` | KPI 카드 | `label` `value` `sub` `unit` `value-class` + `#icon` |
| `AdminDataTable` | 표(검색·로딩·에러·빈상태 내장) | `columns`(`TableColumn[]` from `~/components/admin/DataTable.vue`) `rows` `pending` `error` `title` `total` `shown` `empty-text` + `#default="{ row }"` |
| `AdminSegment` | 세그먼트 토글 | `v-model` `options:[{value,label}]` |
| `AdminSearchInput` | 디바운스 검색 인풋 | `v-model` `placeholder` |
| `AdminEmptyState` | 빈 상태 카드 | `title` `description` + `#icon` |
| `AdminModal` | 모달 | `v-model` `size`(lg/xl) `height` `no-pad` |
| `AdminSlideOver` | 우측 슬라이드 패널(상세·편집용) | `v-model` |

공통 규약: `API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'` · `fetch(..., {cache:'no-store'})` · `onMounted(load)` + 필터 `watch` · 로딩/에러 블록 + KPI/표/그리드.

---

## §0. 스코프 — stub 14개 (team-lead 그룹 기준)

현재 `grep PagePlaceholder pages/` 결과 14개가 stub. team-lead 라벨은 "13개"이나 그룹 열거(아래)는 14개와 일치 → **열거 기준 14개 전부 명세**. 완성된 cost·images·qa-evals·index·login은 대상 제외(표준 패턴 참조원).

| 그룹 | 페이지 | 데이터 |
| --- | --- | --- |
| 운영보드 | uncovered · escalations · chat-logs | 목업 (Phase 2, 백엔드 없음) |
| 지식자산 | **standard-answers**(실) · materials(목업) · catalog(목업) | 혼합 |
| 분석비용 | analytics/quality(목업) · analytics/usage(목업) | 목업 |
| 설정 | settings/ai · safety · cache · integrations | 목업 폼 |
| 시스템 | **accounts**(부분 실) · **audit-logs**(실) | 혼합 |

> 실 API 가용: standard-answers(CRUD 완비) · audit-logs(hp_llm_log via `/admin/cost`) · accounts(`/auth/me`만, 목록 API 미구현).

---

## 운영 보드 (Phase 2 · 목업+empty)

### 1. 미커버 질문 — `/uncovered`
1. **목적**: 챗봇이 못 답한 질문(`is_unknown`/confidence<0.5, 주3건↑ 누적)을 자료·표준답변 보강 작업 큐로 운영.
2. **화면**: `AdminPageHeader` + 필터(`AdminSearchInput` + 상태 `AdminSegment` pending/working/resolved/wont_fix) → `AdminDataTable` 컬럼 `대표질문 / 빈도 / 마지막발생 / 추정 scope·topic / 상태 / 액션([답변작성][자료추가])`. 행클릭 → `AdminSlideOver` 상세(+AI 초안, 비활성).
3. **데이터소스**: 목업(`hp_uncovered_question`·`/uncovered` 미구현, Phase 2).
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminSearchInput` `AdminSegment` `AdminSlideOver`.
5. **empty-state**: "미커버 질문은 챗봇(Phase 2) 가동 후 자동 수집됩니다. 아직 데이터가 없습니다."

### 2. 에스컬레이션 — `/escalations`
1. **목적**: 챗봇 "모름"/저신뢰 분기 질문의 상담사 처리 큐.
2. **화면**: `AdminPageHeader` + 상태 `AdminSegment`(대기/진행/완료) → `AdminDataTable` 컬럼 `질문 / 신뢰도 / 우선순위 / 담당 / 생성·처리시각`. 행클릭 → `AdminSlideOver` 처리 패널(답변작성 + "표준답변 등록", 비활성).
3. **데이터소스**: 목업(`hp_escalation`·`/escalations` 미구현, Phase 2).
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminSegment` `AdminSlideOver`.
5. **empty-state**: "대기 중인 에스컬레이션이 없습니다. (Phase 2 챗봇 가동 후 활성화)"

### 3. 챗봇 로그 — `/chat-logs`
1. **목적**: 사용자 챗 세션·메시지·인용 출처·만족도 열람.
2. **화면**: `AdminPageHeader` + 일자·만족도 필터 → `AdminDataTable` 세션 목록 `사용자 / 시작시각 / 메시지수 / 평균신뢰도 / 만족도👍👎`. 행클릭 → `AdminModal` 대화 타임라인(질문·답변·인용카드·신뢰도).
3. **데이터소스**: 목업(`hp_chat_*`·`/chat-sessions` 미구현, Phase 2).
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminModal` `AdminSegment`.
5. **empty-state**: "챗봇 대화 로그가 없습니다. 사용자 챗봇(Phase 2) 출시 후 기록됩니다."

---

## 지식 자산

### 4. 표준답변 — `/standard-answers` · **실 API**
1. **목적**: 챗봇 1순위 소스 표준답변 카탈로그 조회·작성·편집·삭제. (scope/topic/service_tag·승인은 API 보강 전까지 UI만 비활성)
2. **화면**: `AdminPageHeader`(+`#actions` `[+ 새 표준답변]`) + 툴바(`AdminSearchInput` + projectId `AdminSegment`/select) → `AdminDataTable` 컬럼 `# / label / question(말줄임) / project_id(전사=배지) / usage_count / updated_at / 액션`. 행클릭 → `AdminSlideOver` 상세·편집(label·question·answer 텍스트에어리어).
3. **데이터소스**: `GET /standard-answers?search=&projectId=&page=` · `GET /:id` · `POST /standard-answers` · `PATCH /:id` · `DELETE /:id`. (자동추출 후보: `POST /pms/projects/:id/standard-answer-suggestions`)
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminSearchInput` `AdminSlideOver` `AdminEmptyState`. (qa-evals.vue의 표+모달 패턴 그대로)
5. **empty-state**: "등록된 표준답변이 없습니다. PMS Q&A 분석에서 '표준답변으로 저장'하거나 [+ 새 표준답변]으로 추가하세요."

### 5. 자료 — `/materials` · 목업
1. **목적**: 매뉴얼/PDF/URL/동영상 자료 업로드·인덱싱 상태 관리(OpenSearch 의존, Phase 1 후반).
2. **화면**: `AdminPageHeader`(+`[업로드]`) + 툴바(검색 + kind `AdminSegment` file/url/video_url) → `AdminDataTable` 컬럼 `제목 / 종류 / 형식 / 인덱싱상태(배지) / 청크수 / 업로더 / 등록일 / 액션`. 업로드 `AdminModal`(드롭존/URL 입력, submit 비활성).
3. **데이터소스**: 목업(`/materials/*` 미구현 — OpenSearch 셋업 후 `POST /materials/file|url`, `GET /materials`, `/reindex`, `/transcribe`).
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminModal` `AdminSearchInput` `AdminSegment`.
5. **empty-state**: "업로드된 자료가 없습니다. OpenSearch 인덱싱 파이프라인 연동 후 추가할 수 있습니다. (Phase 1 후반)"

### 6. 토픽·서비스 — `/catalog` · 목업
1. **목적**: 표준답변 분류용 topic(scope=common/service) + service_tag(LMS 패밀리) 카탈로그 관리.
2. **화면**: `AdminPageHeader` + 탭(토픽/서비스) → 토픽 `AdminDataTable` `slug / scope / label / 설명 / 정렬 / 상태`, 서비스 `slug / 이름 / 비고 / 정렬 / 상태`. 각 `[+ 추가]`(`AdminModal`, 비활성). ADMIN-PLAN §4-3-1 기본 카탈로그(topic 10·LMS service 6) 시드 표시.
3. **데이터소스**: 목업(`/topics`·`/services` 미구현). 기본값 하드코딩.
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminModal`(+탭은 `AdminSegment`로 대체 가능).
5. **empty-state**: "기본 카탈로그만 존재합니다. 운영자 추가 항목은 API 연동 후 저장됩니다."

---

## 분석·비용 (목업)

### 7. 응답 품질 — `/analytics/quality` · 목업
1. **목적**: 추천/챗봇 답변 품질 지표(평균 점수 추이·축별 분포·인용 정확도·잘못된 안내 건수) 시각화. KPI 일부는 hp_qa_eval 집계로 실연동 가능.
2. **화면**: `AdminPageHeader`(+기간 `AdminSegment` 7/30/90일, cost.vue 동일) → `AdminKpiCard`×4(평균점수·무수정채택률·인용정확도·저점수건수) + 일별 추이 막대(cost.vue '일별 추이' 패턴) + 축별 분포 리스트.
3. **데이터소스**: 1차 목업. 실연동 후보 = `GET /admin/evals` 집계(overall_score 평균·분포). 전용 `GET /admin/quality` 신설 시 고도화.
4. **재사용**: `AdminPageHeader` `AdminKpiCard` `AdminSegment` + cost.vue 막대 차트 마크업.
5. **empty-state**: "집계할 평가 데이터가 충분하지 않습니다."

### 8. 사용량 — `/analytics/usage` · 목업
1. **목적**: 호출량·엔티티/모델 분포·캐시 적중·기능별 사용 빈도 추이.
2. **화면**: `AdminPageHeader`(+기간) → `AdminKpiCard`×4(총호출·캐시적중률·평균지연·활성기능수) + 엔티티별/모델별 분포 리스트(cost.vue '엔티티별 분포' 재사용) + 일별 호출 막대.
3. **데이터소스**: 1차 목업. 실연동 후보 = `GET /admin/cost`(byModel·byEntity·byDay·summary) 재활용 — **사실상 cost.vue 데이터 일부로 즉시 실연동 가능**.
4. **재사용**: `AdminPageHeader` `AdminKpiCard` `AdminSegment` + cost.vue 분포/막대 마크업.
5. **empty-state**: "표시할 사용량 데이터가 없습니다."

---

## 설정 (목업 폼)

공통: 좌측 라벨 + 우측 입력 폼. 저장 버튼 disabled(`hp_setting` 미구현, 툴팁 "설정 저장 API 보강 예정"). 현재값은 코드 기본/CLAUDE.md 실값 read-only 표시. empty-state 불필요(폼). 재사용: `AdminPageHeader` + Nuxt UI `UForm/UFormField/UInput/UTextarea/USwitch` (이 4페이지는 표 아닌 폼이라 DataTable 미사용).

### 9. AI 설정 — `/settings/ai`
- **목적**: 모델·프롬프트·생성 파라미터. **화면**: 기본모델(`openai/gpt-4.1-mini` read-only)·Vision모델·시스템 프롬프트(챗봇/평가/추천 탭 `UTextarea`)·temperature·max_tokens·timeout·캐시 TTL(24h). **소스**: 목업(`/settings/ai`·`hp_setting` 미구현). 비고: AI Gateway=`malgn-helper2`.

### 10. 안전 가드 — `/settings/safety`
- **목적**: "모름" 분기·PII·금칙어. **화면**: confidence 임계 슬라이더 + PII 정규식 리스트 + 금칙어 사전(태그 입력) + 응답 길이/언어 제한. **소스**: 목업.

### 11. 캐싱 — `/settings/cache`
- **목적**: 캐시 TTL·무효화. **화면**: briefing/qa_eval TTL · 표준답변 in-memory 캐시 크기 · 무효화 트리거 토글 · ["수동 캐시 비우기"](비활성). **소스**: 목업.

### 12. 외부 연동 — `/settings/integrations`
- **목적**: Slack·이메일·티켓·SSO. **화면**: 각 연동 카드(Webhook URL/SMTP/OAuth 입력 + "연결 안 됨" 배지). **소스**: 목업.

---

## 시스템

### 13. 계정 — `/accounts` · 부분 실(tb_user 세션)
1. **목적**: 운영자/상담사 계정·역할 관리. 현재 인증은 tb_user 로그인+세션만, 목록/역할 API 미구현.
2. **화면**: `AdminPageHeader`(+`[+ 초대]` 비활성) → `AdminDataTable` `이메일 / 이름 / company / 역할(배지 admin·developer·agent) / 마지막로그인 / 활성`. 자기 세션 카드는 `/auth/me` 실값, 나머지 행 목업.
3. **데이터소스**: 실 = `GET /auth/me`. 목업 = 사용자 목록. **신설 권장**: `GET /accounts`(tb_user staff) · `PATCH /accounts/:id/role` · 초대.
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminModal`(초대) `AdminEmptyState`.
5. **empty-state**: "표시할 계정이 없습니다. 계정 목록 API 연동 후 채워집니다."

### 14. 감사 로그 — `/audit-logs` · **실 API(hp_llm_log)**
1. **목적**: LLM 호출 감사(비용·지연·실패·캐시 히트). 계정 액션 감사(hp_audit_log)는 미구현 → 1차는 LLM 호출 로그로 채움.
2. **화면**: `AdminPageHeader` + 필터(기간 `AdminSegment` + entity_type + 실패만) → `AdminDataTable` 컬럼 `request_at / route / entity_type / model / 토큰(P/C) / latency_ms / cost_usd / cache_hit(배지) / error(적색)`. (cost.vue '최근 호출' 표 확장)
3. **데이터소스**: 실 = `GET /admin/cost`의 `recent[]`(hp_llm_log)로 즉시 렌더. **권장 신설**: `GET /admin/logs?from=&to=&entityType=&model=&errorOnly=&page=` (전체 감사·페이지네이션).
4. **재사용**: `AdminPageHeader` `AdminDataTable` `AdminSegment`. cost.vue RECENT_COLS 패턴 확장.
5. **empty-state**: "기록된 LLM 호출이 없습니다."

---

## 부록 — admin-dev 인계 메모

1. **우선순위 제안**: 실 API 즉시 연동군 먼저 — ④표준답변(CRUD) → ⑭감사로그(`/admin/cost` recent) → ⑧사용량(`/admin/cost` 재활용) → ⑬계정(`/auth/me`+목록 목업). 나머지 목업은 empty-state 우선.
2. **API 신설 요청(api-dev 협의)**: `GET /admin/logs`(감사 전용) · `GET /accounts`+`PATCH /accounts/:id/role`+초대 · `/image-assets :id PATCH·DELETE`(이미지 태그·숨김, 현재 조회만) · `/materials/*`(OpenSearch 후) · `/topics`·`/services` CRUD · `/settings/*`(hp_setting) · `GET /admin/quality`(품질 집계).
3. **목업 페이지 규약**: 반드시 `AdminEmptyState`를 기본 노출 — "준비 중"이 아니라 "데이터 대기 중"으로 읽히게. 필터·툴바·표 골격은 실제처럼 렌더하되 행만 비움.
4. **표준 준수**: cost.vue(KPI+표+차트), images.vue(그리드+모달), qa-evals.vue(표+슬라이드/모달) 3종이 레이아웃 캐논. 신규 컴포넌트는 이 3종으로 안 풀릴 때만.
5. **권한 가드**: 메뉴는 `use-admin-menu.ts` roles로 필터됨. 페이지 진입 시 역할 확인 + API 403 시 "권한 없음" 안내 일관 처리.
