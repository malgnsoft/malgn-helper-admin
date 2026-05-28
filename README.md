# malgn-helper-admin

Malgn Helper **관리자 프론트엔드**.

- 자료(매뉴얼·Q&A·동영상) 업로드 / 표준 답변 관리
- 상담 로그 / 에스컬레이션 검토
- AI 추천 답변 시연·검수 페이지
- 인덱싱 상태 모니터링

## 스택

Nuxt 3 · Cloudflare Pages.

## 개발·배포

```bash
pnpm install              # 의존성 설치
pnpm dev                  # 로컬 개발 (nuxt dev)
pnpm build                # 프로덕션 빌드
pnpm deploy               # Cloudflare Pages 배포 (.output/public)
```

최초 배포 전 Pages 프로젝트 생성 필요:
```bash
wrangler pages project create malgn-helper-admin
```

`wrangler login` 또는 `CLOUDFLARE_API_TOKEN` 환경변수 필요.

## 참고

- 상위 워크스페이스: [malgn-helper](https://github.com/malgnsoft/malgn-helper)
- 설계 문서: [CLAUDE.md](https://github.com/malgnsoft/malgn-helper/blob/main/CLAUDE.md)
- 로드맵: [doc/roadmap.md](https://github.com/malgnsoft/malgn-helper/blob/main/doc/roadmap.md) — Phase 1 **AI 추천 답변** 관련 화면이 이 저장소의 1차 목표
