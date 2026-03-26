# Draft: wstext - SublimeText Clone Editor

## Requirements (confirmed)
- SublimeText 클론 텍스트 에디터
- 탭 기능, 텍스트 수정, 좌측 라인 번호, 우측 스크롤 미니맵
- 새 파일/저장/불러오기
- 실시간 로컬 자동저장 + 세션 복구 (크래시 후에도)
- Markdown 뷰어 내장
- Todo 모드: `[] 할일` → 체크박스 변환
- 테마 기능 + 폰트 변경
- Ctrl+마우스휠 확대/축소
- Spaces 선택 (2칸/4칸)
- 인코딩 이슈 없어야함
- 하단 라인/컬럼 표시
- JSON/YAML 코드 포맷팅 (확장자 기반 자동 + 수동 변경)
- 플러그인/기타 고급 기능 제외

## Technical Decisions
- **Framework**: Tauri v2 + 순수 Svelte 5 + Vite (confirmed)
- **Editor Engine**: Monaco Editor (confirmed)
- **Platform**: Windows + Mac (confirmed)
- **Theme**: SublimeText Monokai 기본 + 5개 이상 내장 (Monokai, Dracula, One Dark, Solarized Dark, Solarized Light 등)
- **Syntax Highlighting**: Monaco 기본 내장 언어 전체 (추가 작업 없음)
- **Auto-save**: 5초 주기 로컬 세션 상태 자동저장 (파일 자동저장 아님!)
  - 세션 = 열린 탭, 각 탭의 변경 내용, 커서 위치, 스크롤 위치 등
  - 명시적 저장(Ctrl+S)만 실제 파일에 기록
  - 크래시 후 재시작 시 세션 완전 복구

## Final Decisions
- **MD Viewer**: 단일 토글뷰 기본 + 우측 분할 패널 옵션
- **Todo Mode**: 인라인 체크박스 (`[]` → 체크박스 렌더링, 클릭 시 `[x]` 변환)
- **Test Strategy**: 단위 테스트 없음, 에이전트 QA 시나리오로 검증
- **Auto-save Clarification**: 파일 자동저장 X, 로컬 세션 상태 5초 주기 자동저장
  - IndexedDB 또는 Tauri fs를 통한 세션 캐시
  - 명시적 Ctrl+S만 실제 파일에 기록

## Research Findings (Librarian)

### Tauri v2 + Svelte 5
- Tauri 공식 템플릿: `npm create tauri-app@latest -- --template svelte-ts`
- 순수 Svelte + Vite (SvelteKit 불필요)
- Svelte 5 runes: `$state`, `$derived`, `$effect`, `.svelte.ts` 확장자 필수
- Tauri plugins: fs, dialog, store, window-state
- Capabilities에서 `fs:scope`로 `$HOME/**` 허용 필수
- `window-state` 플러그인으로 창 위치/크기 자동 복구

### Monaco Editor + Svelte
- Vite `?worker` 패턴으로 웹 워커 설정 (플러그인 불필요)
- `monaco-yaml` 별도 패키지 + 로컬 re-export 파일 필요
- 멀티탭: 1 editor instance + N models (setModel로 전환)
- 테마: `monaco.editor.defineTheme()` + `inherit: false` + 빈 토큰 규칙 필수
- Todo: Content Widget (interactive) 또는 CSS Decoration (simple)
- 줌: `editor.updateOptions({ fontSize })` + addCommand
- 포맷팅: `editor.action.formatDocument` (JSON 내장, YAML은 monaco-yaml)
- 인코딩: TextDecoder/TextEncoder로 IO 경계에서 처리

### Markdown + Session
- markdown-it v14 선택 (VS Code도 사용, marked보다 안전)
- highlight.js (sync, 선택적 import으로 번들 최소화)
- markdown-it-task-lists로 GFM 체크리스트 지원
- 세션: plugin-store (LazyStore) + 백업 파일 2-tier 전략
- 5초 메타데이터 + 30초 콘텐츠 백업
- `onCloseRequested`로 종료 시 확정 저장

## Scope Boundaries
- INCLUDE: 위 Requirements 전체
- EXCLUDE: 플러그인 시스템, 터미널 내장, Git 통합, 자동완성, LSP
