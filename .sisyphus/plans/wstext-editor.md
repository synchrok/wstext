# wstext — SublimeText Clone Text Editor

## TL;DR

> **Quick Summary**: Tauri v2 + Svelte 5 + Monaco Editor 기반의 SublimeText 클론 데스크톱 텍스트 에디터. 탭/파일관리/세션복구/마크다운뷰어/투두모드/테마/포맷팅을 지원하는 완전한 에디터 구축.
>
> **Deliverables**:
> - Windows + Mac 데스크톱 앱 (Tauri v2 번들)
> - Monaco 기반 멀티탭 에디터 (구문 강조, 미니맵, 라인 번호)
> - 파일 New/Open/Save/Save As (인코딩 보존)
> - 세션 자동저장 + 크래시 복구
> - Markdown 뷰어 (토글 + 분할)
> - Todo 인라인 체크박스
> - 5개 테마 (Monokai/Dracula/One Dark/Solarized Dark/Solarized Light)
> - JSON/YAML 포맷팅
> - Ctrl+휠 줌, 폰트 변경, Spaces 2/4, 하단 상태바
>
> **Estimated Effort**: XL (17 구현 태스크 + 4 검증 태스크)
> **Parallel Execution**: YES — 5 Waves
> **Critical Path**: Task 1 → Task 10 → Task 11 → Task 14 → Task 15 → FINAL

---

## Context

### Original Request
SublimeText를 클론한 텍스트 에디터. 탭, 텍스트 수정, 좌측 라인 번호, 우측 스크롤 미니맵, 파일 New/Save/Open, 실시간 세션 자동저장(크래시 복구), Markdown 뷰어, Todo 모드(인라인 체크박스), 테마/폰트, Ctrl+휠 줌, Spaces 2/4, 인코딩 처리, 하단 라인/컬럼, JSON/YAML 포맷팅.

### Interview Summary
**Key Discussions**:
- **Tech Stack**: Tauri v2 + 순수 Svelte 5 + Vite (SvelteKit 불필요 — 데스크톱 SPA)
- **Editor Engine**: Monaco Editor (미니맵, 구문 강조, 포맷팅 내장)
- **Theme**: Monokai 기본 + 5개 내장 (Monokai, Dracula, One Dark, Solarized Dark, Solarized Light)
- **Auto-save**: 파일 자동저장 아님. 로컬 세션 상태 자동저장 (5초 메타/30초 콘텐츠)
- **MD Viewer**: 단일 토글뷰 기본 + 우측 분할 옵션
- **Todo**: `[]` → 체크박스 렌더링, 클릭으로 `[x]` 토글
- **Syntax**: Monaco 기본 내장 언어 전체
- **Test**: 단위 테스트 없음, 에이전트 QA 시나리오로 검증

**Research Findings**:
- Tauri v2: `npm create tauri-app@latest -- --template svelte-ts` 공식 템플릿
- Monaco Vite: `?worker` 수동 import 패턴 (vite-plugin-monaco-editor 버그 있음)
- Svelte 5 runes: `.svelte.ts` 확장자 필수, `$state`/`$derived`/`$effect`
- Todo 체크박스: CSS Decorations + `onMouseDown` (Content Widget은 overlay 문제)
- Session: `Store.load('session.json', { autoSave: 300 })` + atomic write (temp→rename)
- Encoding: `readFile()` (binary) → BOM 감지 → TextDecoder (readTextFile은 UTF-8 only)
- Markdown: `markdown-it` v14 (VS Code 사용) + `highlight.js` + `DOMPurify`
- 크래시 감지: Sentinel file 패턴 (시작 시 생성, 정상 종료 시 삭제)

### Metis Review
**Identified Gaps** (all addressed):
- Todo 체크박스: Content Widget → CSS Decorations + onMouseDown으로 수정
- 세션 저장: setInterval → Store autoSave debounce + atomic write로 수정
- 크래시 감지: Sentinel file 패턴 추가
- 바이너리 파일 감지: 첫 8KB null byte 스캔 추가
- 대용량 파일 정책: 5MB 경고, 50MB 거부 추가
- 빈 상태 UI: "파일을 열어주세요" 메시지 추가
- Model disposal: 탭 닫을 때 model.dispose() 필수
- macOS 창 복원 버그: visible:false + setup hook 워크어라운드

---

## Work Objectives

### Core Objective
SublimeText의 핵심 편집 경험을 재현하는 경량 데스크톱 텍스트 에디터 구축. Monaco Editor의 강력한 편집 기능 + Tauri의 네이티브 성능 + Svelte 5의 반응성을 결합.

### Concrete Deliverables
- `npm run tauri build`로 생성되는 Windows .msi + Mac .dmg 번들
- 모든 기능이 동작하는 단일 윈도우 텍스트 에디터 앱

### Definition of Done
- [ ] `npm run tauri dev` → 앱 실행, Monaco 에디터 렌더링, 텍스트 입력 가능
- [ ] 파일 열기/저장/새파일이 모두 동작
- [ ] 탭 10개 열고 전환 시 커서/스크롤 보존
- [ ] 앱 강제종료 후 재실행 시 세션 완전 복구
- [ ] 5개 테마 전환 + Ctrl+휠 줌 동작
- [ ] .md 파일 프리뷰 + Todo 체크박스 토글
- [ ] JSON/YAML 포맷팅 동작
- [ ] UTF-16 파일 열기/저장 시 인코딩 보존

### Must Have
- Monaco Editor 기반 텍스트 편집 (라인 번호, 미니맵, 구문 강조)
- 멀티탭 (탭 전환 시 viewState 보존)
- 파일 New/Open/Save/Save As (네이티브 다이얼로그)
- 세션 자동저장 + 크래시 복구 (미저장 탭 포함)
- Markdown 토글뷰 + 분할뷰
- Todo 인라인 체크박스 (`[]`/`[x]` 토글)
- 5개 테마 + 폰트 선택 + Ctrl+휠 줌
- Spaces 2/4 선택
- 인코딩 감지 + 보존 (UTF-8, UTF-16 LE/BE, BOM)
- 하단 상태바 (라인:컬럼, 언어, 인코딩, Spaces)
- JSON/YAML 코드 포맷팅

### Must NOT Have (Guardrails)
- ❌ 파일 트리 / 사이드바
- ❌ 에디터 분할 패널 (마크다운 분할은 OK)
- ❌ 파일 간 검색 (Ctrl+Shift+F)
- ❌ 커맨드 팔레트 (Ctrl+Shift+P)
- ❌ 커스텀 테마 생성/import (5개 내장만)
- ❌ 멀티 윈도우
- ❌ 플러그인 시스템
- ❌ 터미널 내장
- ❌ Git 통합
- ❌ 자동완성 / LSP
- ❌ Undo 히스토리 세션 간 유지 (VS Code도 안 함)
- ❌ 최근 파일 목록
- ❌ JSON/YAML 외 포맷터
- ❌ Mermaid / KaTeX 등 마크다운 확장
- ❌ 자동 업데이트 메커니즘
- ❌ Monaco 내장 기능 재구현 (찾기/바꾸기, 괄호 매칭, 코드 폴딩 등)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: None
- **Framework**: None
- **QA Policy**: 에이전트가 Playwright/tmux/curl로 직접 검증

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Desktop App UI**: Playwright로 Tauri 웹뷰 접근 → DOM 검증 + 스크린샷
- **File Operations**: tmux로 앱 실행 후 Tauri CLI/IPC 테스트
- **Session Recovery**: 프로세스 강제종료 → 재실행 → 상태 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — sequential, everything depends on this):
└── Task 1: Tauri v2 + Svelte 5 + Monaco scaffolding [deep]

Wave 2 (Core Modules — 8 parallel tasks after Wave 1):
├── Task 2: TypeScript types + shared interfaces [quick]
├── Task 3: Theme registration (5 themes) [quick]
├── Task 4: Utility modules (atomic write, encoding, binary detection) [unspecified-high]
├── Task 5: Settings/preferences store [quick]
├── Task 6: App menu bar + keyboard shortcuts [unspecified-high]
├── Task 7: Status bar component [quick]
├── Task 8: Markdown preview component [unspecified-high]
└── Task 9: Todo mode (decorations + click handler) [unspecified-high]

Wave 3 (Core Features — 4 parallel tasks after Wave 2):
├── Task 10: File operations (New/Open/Save/SaveAs + encoding) [deep]
├── Task 11: Multi-tab management (tab bar, model swap, dirty tracking) [deep]
├── Task 12: Zoom + font selection + spaces config [quick]
└── Task 13: Code formatting + language detection/override [unspecified-high]

Wave 4 (Integration — 3 parallel tasks after Wave 3):
├── Task 14: Session persistence + crash recovery [deep]
├── Task 15: Main layout integration + SublimeText styling [visual-engineering]
└── Task 16: Edge case handling (binary, large files, empty state, tab overflow) [unspecified-high]

Wave 5 (Build — after Wave 4):
└── Task 17: Cross-platform build + final polish [unspecified-high]

Wave FINAL (Verification — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA [unspecified-high]
└── F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay
```

Critical Path: Task 1 → Task 10/11 → Task 14 → Task 15 → Task 17 → F1-F4 → user okay
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 8 (Wave 2)

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-9 | 1 |
| 2 | 1 | 10, 11, 14 | 2 |
| 3 | 1 | 11, 15 | 2 |
| 4 | 1 | 10, 14, 16 | 2 |
| 5 | 1 | 12, 14 | 2 |
| 6 | 1 | 10 | 2 |
| 7 | 1 | 15 | 2 |
| 8 | 1 | 15 | 2 |
| 9 | 1 | 15 | 2 |
| 10 | 2, 4, 6 | 14, 16 | 3 |
| 11 | 2, 3 | 14, 15, 16 | 3 |
| 12 | 5 | 15 | 3 |
| 13 | 1 | 15 | 3 |
| 14 | 4, 5, 10, 11 | 17 | 4 |
| 15 | 3, 7, 8, 9, 11, 12, 13 | 17 | 4 |
| 16 | 4, 10, 11 | 17 | 4 |
| 17 | 14, 15, 16 | F1-F4 | 5 |

### Agent Dispatch Summary

- **Wave 1**: **1 task** — T1 → `deep`
- **Wave 2**: **8 tasks** — T2,T5,T7 → `quick`, T3 → `quick`, T4,T6,T8,T9 → `unspecified-high`
- **Wave 3**: **4 tasks** — T10,T11 → `deep`, T12 → `quick`, T13 → `unspecified-high`
- **Wave 4**: **3 tasks** — T14 → `deep`, T15 → `visual-engineering`, T16 → `unspecified-high`
- **Wave 5**: **1 task** — T17 → `unspecified-high`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2,F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Tauri v2 + Svelte 5 + Monaco Editor 프로젝트 스캐폴딩

  **What to do**:
  - `npm create tauri-app@latest wstext -- --template svelte-ts` 실행하여 프로젝트 생성
  - 기존 README.md 보존 (스캐폴딩 후 덮어쓰기됐으면 복원)
  - Tauri 플러그인 설치: `npm run tauri add fs && npm run tauri add dialog && npm run tauri add store && npm run tauri add window-state`
  - `src-tauri/capabilities/default.json` 설정: core:default, fs:default, dialog:default, store:default, window-state:default + `fs:scope` allow `$HOME/**`, `$APPDATA/**`, `$APPCONFIG/**`
  - Monaco Editor 설치: `npm install monaco-editor`
  - `src/lib/monacoWorkers.ts` 생성: `?worker` import 패턴으로 editorWorker, jsonWorker, cssWorker, htmlWorker, tsWorker 설정
  - `vite.config.ts` 수정: `optimizeDeps.exclude: ['monaco-editor']` 추가, `clearScreen: false`, Tauri dev 서버 포트 설정
  - `src/App.svelte`에 기본 Monaco Editor 인스턴스 마운트 (automaticLayout: true, minimap enabled, vs-dark 테마)
  - `src/main.ts`에서 monacoWorkers import (에디터 생성 전에 실행 필수)
  - `src-tauri/tauri.conf.json` 수정: window 설정 (1200x800, minWidth 600, minHeight 400, fileDropEnabled: true, `"visible": false` — macOS 창 복원 워크어라운드)
  - `src-tauri/src/lib.rs`에 모든 플러그인 등록 (.plugin() 체인)
  - `npm run tauri dev`로 앱 실행 확인: Monaco 렌더링, 텍스트 입력, 구문 강조 동작

  **Must NOT do**:
  - SvelteKit 사용하지 않음 (순수 Svelte + Vite)
  - vite-plugin-monaco-editor 사용하지 않음 (ESM/CJS 버그)
  - 기능 구현하지 않음 — 스캐폴딩만

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 프로젝트 초기 설정은 Tauri/Svelte/Monaco/Vite 4개 기술의 정확한 통합이 필요. 설정 오류 시 전체 프로젝트 블로킹.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: 아직 UI 없음, QA는 `npm run tauri dev` 실행 확인만

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2-9 (모든 후속 태스크)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - 없음 (greenfield)

  **API/Type References**:
  - Tauri v2 프로젝트 구조: `src/` (프론트엔드) + `src-tauri/` (Rust 백엔드)
  - `src-tauri/capabilities/default.json` — 권한 설정 파일 (Tauri v2 필수)

  **External References**:
  - Tauri v2 scaffolding: `npm create tauri-app@latest -- --template svelte-ts`
  - Tauri v2 plugins: https://v2.tauri.app/plugin/file-system/, https://v2.tauri.app/plugin/store/
  - Monaco worker setup: Vite `?worker` import pattern (vite-plugin 사용 금지)
  - Svelte 5: `.svelte.ts` 확장자로 runes 사용

  **WHY Each Reference Matters**:
  - Tauri v2 capabilities는 빠뜨리면 모든 fs/dialog/store 호출이 **조용히 실패**함
  - Monaco worker를 잘못 설정하면 구문 강조/포맷팅 전체 불가
  - `visible: false`는 macOS fullscreen 복원 버그 워크어라운드 필수

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: App launches with Monaco editor
    Tool: Bash (tmux)
    Preconditions: Project scaffolded, dependencies installed
    Steps:
      1. Run `npm run tauri dev` in background
      2. Wait 30s for compilation and app launch
      3. Check process list for wstext binary running
      4. Check dev server log for "Vite dev server running"
      5. Check Tauri log for no capability/permission errors
    Expected Result: App process running, no errors in console
    Failure Indicators: "permission denied", "capability not found", worker errors
    Evidence: .sisyphus/evidence/task-1-app-launch.txt

  Scenario: Monaco editor renders correctly
    Tool: Playwright
    Preconditions: App running via `npm run tauri dev`
    Steps:
      1. Connect to Tauri webview
      2. Wait for `.monaco-editor` element to be visible (timeout: 15s)
      3. Verify `.monaco-editor .lines-content` exists
      4. Verify `.minimap` element exists and visible
      5. Click into editor area, type "Hello wstext!"
      6. Assert editor content contains "Hello wstext!"
      7. Screenshot full window
    Expected Result: Monaco editor visible with minimap, text input works
    Failure Indicators: `.monaco-editor` not found, typing doesn't reflect
    Evidence: .sisyphus/evidence/task-1-monaco-render.png
  ```

  **Commit**: YES
  - Message: `feat: scaffold Tauri v2 + Svelte 5 + Monaco editor`
  - Files: `package.json, vite.config.ts, src/*, src-tauri/*`
  - Pre-commit: `npm run tauri dev` (verify app launches)

---

- [x] 2. TypeScript 타입 정의 + 공유 인터페이스

  **What to do**:
  - `src/lib/types.ts` 생성:
    - `TabState`: id (UUID), filePath (string|null), title, content, isDirty, cursor ({line, column}), scrollTop, viewMode ('editor'|'preview'|'split'), encoding (Encoding), language (string)
    - `SessionState`: version (number), activeTabId, tabs (TabState[]), savedAt (timestamp)
    - `Encoding`: 'utf-8' | 'utf-16le' | 'utf-16be' | 'latin1'
    - `AppSettings`: theme, fontFamily, fontSize, tabSize (2|4), wordWrap, minimap
    - `ThemeName`: 'monokai' | 'dracula' | 'one-dark' | 'solarized-dark' | 'solarized-light'
    - `FileInfo`: path, encoding, hasBOM, size, language
    - `ViewMode`: 'editor' | 'preview' | 'split'
  - 모든 타입에 JSDoc 주석 추가 (다른 태스크에서 참조용)
  - `SESSION_VERSION = 1` 상수 export

  **Must NOT do**:
  - 구현 로직 포함하지 않음 — 타입/인터페이스만
  - Svelte 5 runes 사용하지 않음 (순수 .ts 파일)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 타입 정의, 구현 없음
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3-9)
  - **Blocks**: Tasks 10, 11, 14
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Monaco `ICodeEditorViewState` — viewState 타입 참고
  - Tauri `BaseDirectory` — 경로 관련 상수

  **WHY Each Reference Matters**:
  - TabState는 탭 관리, 세션 저장, 파일 작업 모든 곳에서 사용됨
  - version 필드는 세션 마이그레이션에 필수

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Types compile without errors
    Tool: Bash
    Preconditions: Task 1 complete, project set up
    Steps:
      1. Run `npx tsc --noEmit src/lib/types.ts`
      2. Verify exit code 0
      3. Verify all exported types: TabState, SessionState, Encoding, AppSettings, ThemeName, FileInfo, ViewMode
    Expected Result: Zero TypeScript errors, all types exported
    Failure Indicators: Type errors, missing exports
    Evidence: .sisyphus/evidence/task-2-types-check.txt
  ```

  **Commit**: NO (groups with Task 3-5)

---

- [x] 3. 테마 시스템 (5개 테마 등록 + 전환)

  **What to do**:
  - `src/lib/themes.ts` 생성:
    - `registerAllThemes()` 함수: `monaco.editor.defineTheme()`로 5개 테마 모두 등록
    - **Monokai**: bg #272822, fg #F8F8F2, keyword #F92672, string #E6DB74, comment #75715E, function #A6E22E, number #AE81FF
    - **Dracula**: bg #282A36, fg #F8F8F2, keyword #FF79C6, string #F1FA8C, comment #6272A4, function #50FA7B, number #BD93F9
    - **One Dark**: bg #282C34, fg #ABB2BF, keyword #C678DD, string #98C379, comment #5C6370, function #61AFEF, number #D19A66
    - **Solarized Dark**: bg #002B36, fg #839496, keyword #859900, string #2AA198, comment #586E75, function #268BD2, number #D33682
    - **Solarized Light**: bg #FDF6E3, fg #657B83, keyword #859900, string #2AA198, comment #93A1A1, function #268BD2, number #D33682
    - 각 테마에 `inherit: false` + 빈 토큰 규칙 `{ token: '', foreground: '...' }` 필수
    - 각 테마의 `colors` 설정: editor.background, editor.foreground, editorCursor, editor.lineHighlightBackground, editor.selectionBackground, editorLineNumber.foreground, editorIndentGuide.background
  - `setTheme(name: ThemeName)` 함수: `monaco.editor.setTheme()` 호출
  - `getThemeColors(name: ThemeName)` 함수: 테마별 UI 색상 반환 (탭바, 상태바, 사이드바 색상 — Monaco 외부 UI용)
  - **반드시 `registerAllThemes()`를 `main.ts`에서 에디터 생성 전에 호출**

  **Must NOT do**:
  - 커스텀 테마 import/생성 기능 추가하지 않음
  - 6번째 이상 테마 추가하지 않음

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 정적 테마 데이터 정의, 로직 단순
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4-9)
  - **Blocks**: Tasks 11, 15
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Monaco `defineTheme` API: `{ base, inherit, rules, colors }` 구조
  - Monokai 공식 색상: https://monokai.pro/
  - Dracula 공식 색상: https://draculatheme.com/contribute
  - One Dark: Atom One Dark 테마 레퍼런스

  **WHY Each Reference Matters**:
  - `inherit: false` + 빈 토큰 없으면 텍스트가 보이지 않는 치명적 버그 발생
  - 테마 등록이 에디터 생성 후에 일어나면 첫 렌더링 시 기본 테마가 깜빡임

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 5 themes render correctly
    Tool: Playwright
    Preconditions: App running, themes registered
    Steps:
      1. For each theme (monokai, dracula, one-dark, solarized-dark, solarized-light):
         a. Call setTheme(themeName) via browser console
         b. Verify `.monaco-editor` background-color matches theme
         c. Type "const x = 'hello';" in editor
         d. Verify keyword 'const' has theme-specific color
         e. Screenshot
      2. Switch back to monokai, verify no visual glitch
    Expected Result: Each theme applies distinct colors, no invisible text, no flash
    Failure Indicators: White/black text on matching background, keyword not colored
    Evidence: .sisyphus/evidence/task-3-theme-{name}.png (5 screenshots)

  Scenario: Theme-specific UI colors available
    Tool: Bash
    Preconditions: themes.ts exists
    Steps:
      1. Import getThemeColors and call for each theme
      2. Verify returned object has: bgColor, fgColor, tabBarBg, statusBarBg
    Expected Result: Each theme returns distinct UI color set
    Evidence: .sisyphus/evidence/task-3-ui-colors.txt
  ```

  **Commit**: YES (groups with Tasks 2, 4, 5)
  - Message: `feat(core): add types, themes, utilities, and settings store`

---

- [x] 4. 유틸리티 모듈 (Atomic Write, 인코딩, 바이너리 감지)

  **What to do**:
  - `src/lib/utils/atomicWrite.ts`:
    - `atomicWriteText(path, content, baseDir?)`: temp 파일 기록 → rename으로 교체
    - Tauri `writeTextFile` + `rename` 사용
    - 실패 시 temp 파일 정리
  - `src/lib/utils/encoding.ts`:
    - `detectEncoding(bytes: Uint8Array)`: BOM 감지 → {encoding, hasBOM, bomLength}
    - 감지 순서: UTF-16 LE (FF FE) → UTF-16 BE (FE FF) → UTF-8 BOM (EF BB BF) → UTF-8 기본
    - `decodeContent(bytes: Uint8Array, encoding: Encoding, bomLength: number)`: TextDecoder로 디코딩
    - `encodeContent(content: string, encoding: Encoding, hasBOM: boolean)`: TextEncoder + BOM 추가
    - `readFileWithEncoding(path)`: readFile (binary) → detectEncoding → decodeContent → {content, encoding, hasBOM}
    - `writeFileWithEncoding(path, content, encoding, hasBOM)`: encodeContent → writeFile (binary)
    - **반드시 `readFile()` 사용 (readTextFile은 UTF-8 only)**
  - `src/lib/utils/binaryDetection.ts`:
    - `isBinaryFile(bytes: Uint8Array)`: 첫 8KB 내 null byte (0x00) 존재 시 true
    - 빈 파일은 false 반환
  - `src/lib/utils/fileLanguage.ts`:
    - `detectLanguage(filePath: string)`: 확장자 → Monaco language ID 매핑
    - 지원: .ts/.tsx, .js/.jsx, .json, .yaml/.yml, .html, .css/.scss, .md, .py, .rs, .go, .java, .c/.cpp, .sh, .sql, .xml, .toml
    - 확장자 없으면 'plaintext' 반환

  **Must NOT do**:
  - chardet 같은 heuristic 인코딩 감지 라이브러리 사용하지 않음 (BOM 기반만)
  - 지원하지 않는 인코딩(EUC-KR, Shift-JIS 등) 추가하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 인코딩 처리는 바이트 레벨 정확성 필요, atomic write는 에러 핸들링 중요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 5-9)
  - **Blocks**: Tasks 10, 14, 16
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Tauri `readFile`: `@tauri-apps/plugin-fs` — Uint8Array 반환
  - Tauri `writeFile`: `@tauri-apps/plugin-fs` — Uint8Array 입력
  - Tauri `rename`: 파일 원자적 교체
  - TextDecoder/TextEncoder Web API
  - BOM specs: UTF-8 (EF BB BF), UTF-16 LE (FF FE), UTF-16 BE (FE FF)

  **WHY Each Reference Matters**:
  - `readTextFile`은 UTF-8 only — UTF-16 파일을 깨뜨림
  - atomic write 없으면 크래시 시 파일 손상 위험
  - BOM 감지 순서 틀리면 UTF-16 LE를 UTF-8로 잘못 읽음

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: UTF-16 LE round-trip
    Tool: Bash
    Preconditions: Utility modules created
    Steps:
      1. Create test UTF-16 LE file with BOM: echo -ne '\xff\xfe' > test-utf16le.txt && printf 'H\x00e\x00l\x00l\x00o\x00' >> test-utf16le.txt
      2. Call readFileWithEncoding('test-utf16le.txt')
      3. Assert encoding === 'utf-16le' && hasBOM === true && content === 'Hello'
      4. Call writeFileWithEncoding('test-output.txt', 'Hello', 'utf-16le', true)
      5. Binary compare: diff <(xxd test-utf16le.txt) <(xxd test-output.txt)
    Expected Result: Files are byte-identical
    Failure Indicators: Encoding mismatch, BOM missing, garbled text
    Evidence: .sisyphus/evidence/task-4-encoding-roundtrip.txt

  Scenario: Binary file detection
    Tool: Bash
    Steps:
      1. Create binary file: dd if=/dev/urandom bs=1024 count=1 > test-binary.bin
      2. Create text file: echo "Hello world" > test-text.txt
      3. Call isBinaryFile on both
      4. Assert binary.bin → true, text.txt → false
    Expected Result: Binary correctly detected, text not flagged
    Evidence: .sisyphus/evidence/task-4-binary-detection.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 5)
  - Message: `feat(core): add types, themes, utilities, and settings store`

---

- [x] 5. 설정/환경설정 스토어

  **What to do**:
  - `src/lib/stores/settings.svelte.ts` 생성 (Svelte 5 runes):
    - `appSettings` — `$state<AppSettings>` 초기값:
      - theme: 'monokai'
      - fontFamily: 'Consolas, Monaco, monospace'
      - fontSize: 14
      - tabSize: 4
      - wordWrap: 'off'
      - minimap: true
    - `loadSettings()`: Tauri `LazyStore`에서 설정 로드 (없으면 기본값)
    - `saveSettings()`: 현재 설정을 Store에 저장
    - `updateSetting(key, value)`: 개별 설정 업데이트 + 자동 저장
    - 설정 변경 시 `$effect`로 자동 persist (debounce 300ms)
  - `src/lib/stores/settings.svelte.ts`에서 `LazyStore('settings.json')` 사용
  - `loadSettings()`를 앱 시작 시 호출

  **Must NOT do**:
  - 설정 UI 만들지 않음 (Task 15에서 통합)
  - localStorage 사용하지 않음 (Tauri Store 사용)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Tauri Store API + Svelte runes 조합, 단순 CRUD
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2-4, 6-9)
  - **Blocks**: Tasks 12, 14
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Tauri `LazyStore`: `@tauri-apps/plugin-store` — loads on first access
  - Svelte 5 runes in modules: `.svelte.ts` 확장자 필수

  **WHY Each Reference Matters**:
  - `LazyStore`가 `load()`보다 시작 성능 좋음 (첫 접근 시 로드)
  - `.svelte.ts` 안 쓰면 `$state` 동작 안 함

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Settings persist across restart
    Tool: Bash + Playwright
    Steps:
      1. Launch app, change theme to 'dracula' via updateSetting('theme', 'dracula')
      2. Close app cleanly
      3. Check AppData for settings.json file existence
      4. Relaunch app
      5. Verify loaded theme === 'dracula'
    Expected Result: Setting survives app restart
    Failure Indicators: Default theme on restart, settings.json missing
    Evidence: .sisyphus/evidence/task-5-settings-persist.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 4)
  - Message: `feat(core): add types, themes, utilities, and settings store`

---

- [x] 6. 앱 메뉴바 + 키보드 단축키

  **What to do**:
  - `src/lib/menu.ts` 생성:
    - Tauri Menu API로 네이티브 메뉴바 구성
    - **File**: New (Ctrl+N), Open (Ctrl+O), Save (Ctrl+S), Save As (Ctrl+Shift+S), Separator, Quit (Ctrl+Q)
    - **Edit**: Undo, Redo, Separator, Cut, Copy, Paste, Select All (PredefinedMenuItem 사용)
    - **View**: Toggle Minimap, Toggle Word Wrap, Zoom In (Ctrl+=), Zoom Out (Ctrl+-), Reset Zoom (Ctrl+0), Separator, Toggle Markdown Preview (Ctrl+Shift+M)
    - **Theme**: 5개 테마 각각 라디오 메뉴 아이템
    - 모든 Submenu 내부에 MenuItem (macOS 호환 — 최상위 아이템 무시됨)
  - `src/lib/shortcuts.ts` 생성:
    - 메뉴 외 추가 단축키: Ctrl+W (탭 닫기), Ctrl+Tab (다음 탭), Ctrl+Shift+Tab (이전 탭)
    - `setupKeyboardShortcuts()` 함수 — 앱 시작 시 호출
  - 메뉴 액션은 이벤트만 emit (실제 핸들러는 각 feature 태스크에서 연결)

  **Must NOT do**:
  - 커맨드 팔레트 (Ctrl+Shift+P) 추가하지 않음
  - 실제 파일 열기/저장 로직 구현하지 않음 (이벤트만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Tauri Menu API + macOS 호환성 주의 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2-5, 7-9)
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Tauri Menu API: `@tauri-apps/api/menu` — Menu, MenuItem, Submenu, PredefinedMenuItem
  - macOS 주의: 최상위 아이템은 Submenu 안에 있어야 함

  **WHY Each Reference Matters**:
  - macOS에서 Submenu 없는 최상위 아이템은 무시됨 — 메뉴 전혀 안 보일 수 있음

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Menu bar renders with all items
    Tool: Playwright
    Steps:
      1. Launch app
      2. Verify menu bar exists (platform-specific: Windows = app menu, Mac = system menu)
      3. Click File menu → verify: New, Open, Save, Save As, Quit visible
      4. Click View menu → verify: Toggle Minimap, Zoom In/Out, Markdown Preview visible
      5. Click Theme menu → verify: 5 theme options visible
    Expected Result: All menu items present and clickable
    Evidence: .sisyphus/evidence/task-6-menu-bar.png

  Scenario: Keyboard shortcuts fire events
    Tool: Playwright
    Steps:
      1. Press Ctrl+N → verify 'new-file' event fired (check console log)
      2. Press Ctrl+S → verify 'save-file' event fired
      3. Press Ctrl+Shift+M → verify 'toggle-preview' event fired
    Expected Result: All shortcuts trigger correct events
    Evidence: .sisyphus/evidence/task-6-shortcuts.txt
  ```

  **Commit**: YES (groups with Task 7)
  - Message: `feat(ui): add app menu, shortcuts, and status bar`

---

- [x] 7. 상태바 컴포넌트

  **What to do**:
  - `src/lib/components/StatusBar.svelte` 생성:
    - 하단 고정 바 (SublimeText 스타일, 높이 ~22px)
    - 좌측: 라인:컬럼 표시 (예: `Ln 42, Col 15`)
    - 중앙: 현재 인코딩 (예: `UTF-8`) + Spaces/Tab 크기 (예: `Spaces: 4`)
    - 우측: 현재 언어 (예: `TypeScript`)
    - Props: `line`, `column`, `encoding`, `tabSize`, `language`
    - 인코딩, 탭 크기, 언어는 클릭 가능 → 변경 드롭다운 표시 (Task 15에서 연결)
    - 테마 색상 적용 (getThemeColors 사용)

  **Must NOT do**:
  - 파일 크기, Git 브랜치, 워드 카운트 등 추가 정보 표시하지 않음
  - 드롭다운 실제 동작 구현하지 않음 (클릭 이벤트만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 Svelte 컴포넌트, 표시 전용
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2-6, 8-9)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - SublimeText 상태바 레이아웃 참고 (좌: Ln/Col, 우: 언어/인코딩)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Status bar displays correct info
    Tool: Playwright
    Steps:
      1. Open app
      2. Find `.status-bar` element
      3. Verify line/column text visible (default: "Ln 1, Col 1")
      4. Verify encoding text visible (default: "UTF-8")
      5. Verify spaces text visible (default: "Spaces: 4")
      6. Verify language text visible (default: "Plain Text")
      7. Click in editor at line 5, column 10
      8. Verify status bar updates to "Ln 5, Col 10"
    Expected Result: All status bar sections present and update on cursor move
    Evidence: .sisyphus/evidence/task-7-statusbar.png
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(ui): add app menu, shortcuts, and status bar`

---

- [x] 8. Markdown 프리뷰 컴포넌트

  **What to do**:
  - `npm install markdown-it markdown-it-task-lists highlight.js dompurify @types/dompurify @types/markdown-it`
  - `src/lib/markdown.ts` 생성:
    - `markdown-it` 싱글톤 인스턴스 (모듈 레벨 — 매번 생성하지 않음)
    - 설정: `html: false`, `linkify: true`, `typographer: true`
    - `highlight` 콜백: `highlight.js` selective import (typescript, javascript, python, rust, go, json, yaml, html, css, sql, bash)
    - `.enable('table')`, `.enable('strikethrough')`
    - `markdown-it-task-lists` 플러그인 (`{ enabled: true, label: true }`)
    - `renderMarkdown(source: string): string` 함수 — DOMPurify.sanitize() 적용
  - `src/lib/components/MarkdownPreview.svelte` 생성:
    - Props: `source: string`, `mode: 'toggle' | 'split'`
    - 150ms debounce로 렌더링 ($effect + clearTimeout)
    - 토글 모드: 에디터 영역 전체를 프리뷰로 교체
    - 분할 모드: 우측 50% 패널에 프리뷰 표시
    - `{@html rendered}` 로 HTML 삽입
    - 프리뷰 CSS: GitHub-style markdown 스타일링 (코드 블록 배경, 테이블 테두리, 체크리스트 등)
    - 현재 테마에 맞는 프리뷰 색상 (다크 테마 → 다크 프리뷰)

  **Must NOT do**:
  - Mermaid, KaTeX, 임베디드 미디어 지원하지 않음
  - 에디터-프리뷰 스크롤 동기화 구현하지 않음 (복잡도 높음)
  - 마크다운 AST 기반 처리 (remark) 사용하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: markdown-it 설정 + highlight.js 통합 + DOMPurify + CSS 스타일링 복합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2-7, 9)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - markdown-it v14: https://github.com/markdown-it/markdown-it
  - highlight.js selective import: `import hljs from 'highlight.js/lib/core'` + 언어별 import
  - DOMPurify: `DOMPurify.sanitize(html)` — XSS 방지
  - GFM tables: `md.enable('table')` — markdown-it 내장

  **WHY Each Reference Matters**:
  - `html: true`면 XSS 가능 — Tauri webview에서도 JS 실행됨
  - highlight.js 전체 import하면 1MB+ 번들 — selective import 필수
  - 싱글톤 md 인스턴스 안 쓰면 렌더마다 인스턴스 생성 오버헤드

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Markdown renders correctly
    Tool: Playwright
    Steps:
      1. Set editor content to "# Hello\n\n**bold** and *italic*\n\n```js\nconst x = 1;\n```\n\n| Col1 | Col2 |\n|------|------|\n| A | B |"
      2. Toggle markdown preview mode
      3. Verify `h1` element with text "Hello" exists in preview
      4. Verify `strong` element with "bold" exists
      5. Verify `code` element with syntax-highlighted JS exists
      6. Verify `table` element exists
      7. Screenshot
    Expected Result: All markdown elements render correctly
    Evidence: .sisyphus/evidence/task-8-markdown-render.png

  Scenario: XSS prevention
    Tool: Playwright
    Steps:
      1. Set editor content to "<img onerror=alert(1) src=x>"
      2. Toggle markdown preview
      3. Verify no alert dialog appears
      4. Verify `img` tag is sanitized (onerror removed)
    Expected Result: No script execution, sanitized HTML
    Evidence: .sisyphus/evidence/task-8-xss-prevention.txt
  ```

  **Commit**: YES (groups with Task 9)
  - Message: `feat(modes): add markdown preview and todo mode`

---

- [x] 9. Todo 모드 (인라인 체크박스)

  **What to do**:
  - `src/lib/todo.ts` 생성:
    - `applyTodoDecorations(editor)`: 에디터 텍스트에서 `[]` 및 `[x]` 패턴 찾아 CSS decoration 적용
    - regex: `/\[([ x])\]/g` — 각 매치에 `inlineClassName` 적용
    - unchecked (`[]`): `.todo-unchecked` 클래스 (파란색 체크박스 스타일)
    - checked (`[x]`): `.todo-checked` 클래스 (녹색 + line-through 스타일)
    - `setupTodoClickHandler(editor)`: `editor.onMouseDown` 이벤트 리스너
      - 클릭 위치의 decorations 확인
      - todo decoration 위를 클릭했으면 텍스트 토글: `[]` ↔ `[x]`
      - `model.pushEditOperations()`으로 변경 (undo 가능하도록)
    - `refreshDecorations()`: 텍스트 변경 시 decoration 재계산
    - `editor.onDidChangeModelContent` 이벤트로 자동 refresh (debounce 100ms)
  - `src/app.css`에 todo 스타일 추가:
    - `.todo-unchecked::before { content: '☐'; }` 스타일
    - `.todo-checked::before { content: '☑'; color: #4CAF50; }` 스타일

  **Must NOT do**:
  - Content Widget 사용하지 않음 (overlay 문제 — CSS Decoration + onMouseDown 사용)
  - 체크박스 카운트, 진행률, 필터링 등 추가하지 않음
  - 체크 완료 항목 strike-through 외 추가 스타일링 없음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Monaco decoration API + 이벤트 핸들링 + CSS 조합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2-8)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Monaco `deltaDecorations` API — decoration 추가/업데이트
  - Monaco `onMouseDown` — 클릭 이벤트의 position과 target 정보
  - Monaco `pushEditOperations` — undo 가능한 텍스트 수정

  **WHY Each Reference Matters**:
  - Content Widget은 텍스트 위에 overlay되어 위치가 정확하지 않음
  - `pushEditOperations` 안 쓰면 토글이 undo 스택에 안 들어감

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Todo checkbox renders and toggles
    Tool: Playwright
    Steps:
      1. Set editor content to "[] Buy groceries\n[x] Read book\n[] Write code"
      2. Verify 3 todo decorations exist (.todo-unchecked x2, .todo-checked x1)
      3. Click on the `[]` of line 1 ("Buy groceries")
      4. Verify line 1 text changed to "[x] Buy groceries"
      5. Verify decoration updated to .todo-checked
      6. Click again on `[x]` of line 1
      7. Verify line 1 text reverted to "[] Buy groceries"
      8. Press Ctrl+Z → verify undo works (back to [x])
    Expected Result: Checkboxes toggle, undo works
    Evidence: .sisyphus/evidence/task-9-todo-toggle.png
  ```

  **Commit**: YES (groups with Task 8)
  - Message: `feat(modes): add markdown preview and todo mode`

---

- [x] 10. 파일 작업 (New/Open/Save/Save As + 인코딩)

  **What to do**:
  - `src/lib/fileOps.svelte.ts` 생성 (Svelte 5 runes):
    - `newFile()`: 새 탭 생성 (title: "Untitled-N", filePath: null, encoding: 'utf-8')
    - `openFile()`:
      1. Tauri `open()` dialog → 파일 경로 획득
      2. `readFile()` (binary) → Uint8Array
      3. `isBinaryFile()` 체크 → binary면 에러 메시지 표시, 열지 않음
      4. `detectEncoding()` → encoding, hasBOM 파악
      5. `decodeContent()` → 문자열 변환
      6. `detectLanguage()` → 확장자 기반 언어 감지
      7. 파일 크기 체크: >50MB → 거부, >5MB → 경고 (미니맵 비활성)
      8. 동일 파일 이미 열려있으면 해당 탭 활성화 (중복 방지 — 경로 정규화 비교)
      9. 새 탭으로 열기
    - `saveFile(tabState)`:
      1. filePath 없으면 → `saveFileAs()` 호출
      2. `writeFileWithEncoding()` → 원본 인코딩 + BOM 보존
      3. isDirty = false 업데이트
    - `saveFileAs(tabState)`:
      1. Tauri `save()` dialog → 저장 경로 획득
      2. `writeFileWithEncoding()` 호출
      3. filePath, title 업데이트
    - 모든 작업에 try/catch → 사용자에게 에러 메시지 표시
  - 메뉴 이벤트 (Task 6)와 연결: Ctrl+N → newFile, Ctrl+O → openFile, Ctrl+S → saveFile, Ctrl+Shift+S → saveFileAs
  - 파일 드롭 지원: Tauri `onFileDropEvent` → openFile 호출

  **Must NOT do**:
  - "Save All" 기능 추가하지 않음
  - 파일 자동저장 (실제 파일에) 하지 않음
  - 최근 파일 목록 관리하지 않음

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Tauri fs/dialog API + 인코딩 처리 + 에러 핸들링 복합. 파일 열기/저장은 전체 앱의 핵심 경로.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13)
  - **Blocks**: Tasks 14, 16
  - **Blocked By**: Tasks 2, 4, 6

  **References**:

  **Pattern References**:
  - `src/lib/utils/encoding.ts` (Task 4) — readFileWithEncoding, writeFileWithEncoding
  - `src/lib/utils/binaryDetection.ts` (Task 4) — isBinaryFile
  - `src/lib/utils/fileLanguage.ts` (Task 4) — detectLanguage
  - `src/lib/menu.ts` (Task 6) — 메뉴 이벤트 바인딩

  **External References**:
  - Tauri `open()`: `@tauri-apps/plugin-dialog` — 파일 선택 다이얼로그
  - Tauri `save()`: `@tauri-apps/plugin-dialog` — 저장 다이얼로그
  - Tauri `readFile()`: `@tauri-apps/plugin-fs` — Uint8Array 반환
  - Tauri file drop: `getCurrentWebview().onDragDropEvent()`

  **WHY Each Reference Matters**:
  - `open()`은 scope 제한 bypass — dialog 선택 파일은 자동 허용
  - `readFile` (binary) vs `readTextFile` (UTF-8 only) 구분 필수
  - 파일 드롭은 Tauri webview의 `onDragDropEvent` 사용

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Open and save text file
    Tool: Playwright + Bash
    Steps:
      1. Create test file: echo "Hello World" > /tmp/test-wstext.txt
      2. Launch app
      3. Trigger Ctrl+O → file dialog opens
      4. Select /tmp/test-wstext.txt
      5. Verify editor content === "Hello World"
      6. Verify status bar shows "UTF-8" encoding
      7. Type " Modified" at end
      8. Press Ctrl+S
      9. Read /tmp/test-wstext.txt from disk
      10. Verify content === "Hello World Modified"
    Expected Result: File opens, edits, saves correctly
    Evidence: .sisyphus/evidence/task-10-file-ops.txt

  Scenario: Binary file rejected
    Tool: Playwright
    Steps:
      1. Try to open a .png file
      2. Verify error message displayed: "Binary file — cannot display"
      3. Verify no new tab created
    Expected Result: Binary file detected and rejected
    Evidence: .sisyphus/evidence/task-10-binary-reject.png

  Scenario: Large file warning
    Tool: Bash + Playwright
    Steps:
      1. Create 6MB text file: python -c "print('x'*100*60000)" > /tmp/large.txt
      2. Open in app
      3. Verify warning message about large file
      4. Verify minimap is disabled for this tab
    Expected Result: Warning shown, degraded mode active
    Evidence: .sisyphus/evidence/task-10-large-file.png
  ```

  **Commit**: YES
  - Message: `feat(files): implement file operations with encoding support`

---

- [x] 11. 멀티탭 관리 (탭바, 모델 스왑, 더티 추적)

  **What to do**:
  - `src/lib/stores/tabs.svelte.ts` 생성 (Svelte 5 runes):
    - `tabs` — `$state<TabState[]>([])`
    - `activeTabId` — `$state<string | null>(null)`
    - `activeTab` — `$derived(tabs.find(t => t.id === activeTabId))`
    - `openTab(fileInfo, content)`: 새 TabState 생성, Monaco model 생성 (`monaco.editor.createModel(content, language, uri)`), tabs 배열에 추가
    - `switchTab(editor, tabId)`: 현재 viewState 저장 (`editor.saveViewState()`), 대상 model로 전환 (`editor.setModel(model)`), viewState 복원 (`editor.restoreViewState()`)
    - `closeTab(editor, tabId)`:
      1. isDirty면 확인 다이얼로그 ("저장하시겠습니까?")
      2. `model.dispose()` 호출 (메모리 해제 + URI 재사용 가능)
      3. tabs 배열에서 제거
      4. 남은 탭 없으면 빈 상태 표시
      5. 이전 활성 탭 또는 인접 탭으로 전환
    - `updateTabContent(tabId, content)`: isDirty = true 설정
    - `markTabClean(tabId)`: isDirty = false (저장 후)
    - 중복 방지: 동일 filePath의 탭이 이미 있으면 해당 탭 활성화
  - `src/lib/components/TabBar.svelte` 생성:
    - 수평 탭 바 (SublimeText 스타일)
    - 각 탭: 파일명 + 더티 인디케이터 (● 또는 ✕) + 닫기 버튼 (×)
    - 활성 탭 하이라이트
    - 탭 클릭 → switchTab
    - 닫기 버튼 클릭 → closeTab
    - 탭 오버플로우 시 수평 스크롤 (SublimeText 방식)
    - 마우스 가운데 버튼 클릭으로 탭 닫기
    - 테마 색상 적용
  - `editor.onDidChangeModelContent` 이벤트로 isDirty 자동 업데이트

  **Must NOT do**:
  - 탭 드래그앤드롭 재정렬하지 않음
  - 탭 그룹, 고정 탭, 탭 색상 추가하지 않음
  - 우클릭 컨텍스트 메뉴 추가하지 않음
  - 에디터 분할 패널 추가하지 않음

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Monaco model 라이프사이클 관리 + viewState 저장/복원 + 더티 추적. 탭 관리 오류는 메모리 릭과 URI 충돌 유발.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 12, 13)
  - **Blocks**: Tasks 14, 15, 16
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/lib/types.ts` (Task 2) — TabState 인터페이스
  - `src/lib/themes.ts` (Task 3) — getThemeColors로 탭바 색상

  **External References**:
  - Monaco `createModel(content, language, uri)` — 파일별 모델 생성
  - Monaco `editor.setModel(model)` — 탭 전환 시 모델 스왑
  - Monaco `editor.saveViewState()` / `restoreViewState()` — 커서/스크롤 보존
  - Monaco `model.dispose()` — 반드시 호출 (메모리 릭 방지, URI 재사용)

  **WHY Each Reference Matters**:
  - 1 editor + N models 패턴이 핵심 — editor 여러 개 만들면 성능 저하
  - `model.dispose()` 빠뜨리면 같은 파일 재열기 시 `URI already exists` 에러
  - `saveViewState/restoreViewState` 없으면 탭 전환 시 커서/스크롤 리셋

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Multi-tab with view state preservation
    Tool: Playwright
    Steps:
      1. Open file1.txt, type text, move cursor to line 50
      2. Open file2.json, type text, move cursor to line 10
      3. Switch to file1.txt tab
      4. Verify cursor is at line 50 (not reset to 1)
      5. Verify scroll position preserved
      6. Switch back to file2.json
      7. Verify cursor at line 10
    Expected Result: Cursor and scroll preserved across tab switches
    Evidence: .sisyphus/evidence/task-11-viewstate.txt

  Scenario: Tab close with dirty check
    Tool: Playwright
    Steps:
      1. Open file, type unsaved changes
      2. Verify dirty indicator (●) visible on tab
      3. Click close button
      4. Verify confirmation dialog appears
      5. Click "Don't Save"
      6. Verify tab closed, no file written
      7. Verify no memory leak (model disposed — same file can be reopened)
    Expected Result: Dirty check works, model properly disposed
    Evidence: .sisyphus/evidence/task-11-dirty-close.png

  Scenario: Tab overflow scrolling
    Tool: Playwright
    Steps:
      1. Open 15+ files (enough to overflow tab bar)
      2. Verify horizontal scroll appears
      3. Scroll to last tab, click it
      4. Verify correct file displayed
    Expected Result: All tabs accessible via scroll
    Evidence: .sisyphus/evidence/task-11-tab-overflow.png
  ```

  **Commit**: YES
  - Message: `feat(tabs): implement multi-tab with model swap and dirty tracking`

---

- [x] 12. 줌 (Ctrl+마우스휠) + 폰트 선택 + Spaces 설정

  **What to do**:
  - `src/lib/zoom.ts` 생성:
    - `setupZoom(editor)`: Ctrl+마우스휠 이벤트 핸들러 등록
      - Ctrl+Wheel Up → fontSize += 2 (max 40)
      - Ctrl+Wheel Down → fontSize -= 2 (min 8)
      - Ctrl+0 → fontSize = 기본값 (14)
    - `editor.updateOptions({ fontSize })` 호출
    - 현재 fontSize를 settings store에 저장 (persist)
  - `src/lib/stores/settings.svelte.ts` 확장:
    - `fontFamily` 변경 함수 → `editor.updateOptions({ fontFamily })`
    - `tabSize` 변경 함수 (2 또는 4) → `editor.getModel().updateOptions({ tabSize, insertSpaces: true })`
    - 설정 변경 시 현재 열린 에디터에 즉시 반영
  - Monaco 에디터 키보드 단축키 추가:
    - `Ctrl+=` → zoomIn
    - `Ctrl+-` → zoomOut
    - `Ctrl+0` → resetZoom
  - 폰트 목록: 시스템 기본 monospace 폰트들 하드코딩 (Consolas, Monaco, Menlo, 'Courier New', monospace)

  **Must NOT do**:
  - 시스템 폰트 동적 감지하지 않음 (하드코딩 목록)
  - 줌 레벨 퍼센트 표시하지 않음

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Monaco updateOptions API 호출 + 이벤트 핸들러, 단순한 로직
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 13)
  - **Blocks**: Task 15
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/lib/stores/settings.svelte.ts` (Task 5) — 설정 persist

  **External References**:
  - Monaco `editor.updateOptions({ fontSize, fontFamily })` — 런타임 변경
  - Monaco `model.updateOptions({ tabSize, insertSpaces })` — 모델별 설정
  - DOM `wheel` event: `event.ctrlKey && event.deltaY`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Ctrl+mousewheel zoom
    Tool: Playwright
    Steps:
      1. Get initial font size (should be 14)
      2. Ctrl+Wheel Up 3 times
      3. Verify font size increased to 20
      4. Ctrl+Wheel Down 5 times
      5. Verify font size decreased to 10
      6. Ctrl+0
      7. Verify font size reset to 14
      8. Close and reopen app
      9. Verify font size persisted (14)
    Expected Result: Zoom works, persists across restart
    Evidence: .sisyphus/evidence/task-12-zoom.txt

  Scenario: Spaces setting changes
    Tool: Playwright
    Steps:
      1. Verify default tabSize = 4
      2. Change to tabSize = 2
      3. Type Tab key in editor
      4. Verify 2 spaces inserted (not 4)
      5. Verify status bar shows "Spaces: 2"
    Expected Result: Tab size change applies immediately
    Evidence: .sisyphus/evidence/task-12-spaces.txt
  ```

  **Commit**: YES (groups with Task 13)
  - Message: `feat(editor): add zoom, font, spaces, formatting, language override`

---

- [x] 13. 코드 포맷팅 (JSON/YAML) + 언어 감지/오버라이드

  **What to do**:
  - `npm install monaco-yaml`
  - `src/lib/monacoWorkers.ts` 확장:
    - YAML worker 로컬 re-export 파일 생성: `src/lib/yaml.worker.ts` → `import 'monaco-yaml/yaml.worker.js'`
    - getWorker에 yaml 케이스 추가
    - `configureMonacoYaml(monaco, { validate: true })` 호출
  - `src/lib/formatting.ts` 생성:
    - `formatDocument(editor)`: `editor.getAction('editor.action.formatDocument')?.run()`
    - `formatSelection(editor)`: `editor.getAction('editor.action.formatSelection')?.run()`
    - Ctrl+Shift+I 또는 Shift+Alt+F 단축키 등록
  - `src/lib/languageOverride.ts` 생성:
    - `setLanguage(model, languageId)`: `monaco.editor.setModelLanguage(model, languageId)`
    - 언어 목록: Monaco 기본 내장 언어 전체 → 드롭다운용 배열
    - 파일 확장자 자동 감지 (Task 4의 detectLanguage) + 수동 오버라이드
    - 상태바의 언어 표시 클릭 시 언어 선택 드롭다운

  **Must NOT do**:
  - JSON/YAML 외 추가 포맷터 (Prettier, Black 등) 설치하지 않음
  - YAML 스키마 검증 / LSP 추가하지 않음
  - 자동 포맷팅 (저장 시 자동 등) 하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: monaco-yaml 워커 설정 + 언어 오버라이드 UI 조합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/lib/monacoWorkers.ts` (Task 1) — 워커 설정 확장
  - `src/lib/utils/fileLanguage.ts` (Task 4) — 확장자 → 언어 매핑

  **External References**:
  - `monaco-yaml`: https://github.com/remcohaszing/monaco-yaml — YAML 워커 + 포맷터
  - YAML 워커 로컬 re-export: `import 'monaco-yaml/yaml.worker.js'` (직접 import 금지 — Vite 오류)
  - Monaco `setModelLanguage()`: 모델의 언어 변경
  - Monaco `editor.action.formatDocument`: 내장 포맷팅 액션

  **WHY Each Reference Matters**:
  - `monaco-yaml/yaml.worker.js` 직접 import하면 Vite `Unexpected usage` 에러
  - JSON 포맷팅은 Monaco 내장 — 별도 설치 불필요
  - `setModelLanguage`로 확장자와 무관하게 언어 변경 가능

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: JSON formatting
    Tool: Playwright
    Steps:
      1. Open/create file with content: {"a":1,"b":[2,3],"c":{"d":4}}
      2. Set language to JSON (auto by .json extension or manual)
      3. Trigger format document (Shift+Alt+F)
      4. Verify content is indented with current tabSize setting
      5. Verify valid JSON structure preserved
    Expected Result: JSON properly formatted
    Evidence: .sisyphus/evidence/task-13-json-format.txt

  Scenario: Language override
    Tool: Playwright
    Steps:
      1. Open a .txt file
      2. Verify language shows "Plain Text" in status bar
      3. Click language in status bar → language picker appears
      4. Select "JavaScript"
      5. Verify syntax highlighting applies for JS
      6. Verify status bar shows "JavaScript"
    Expected Result: Language changed, highlighting updated
    Evidence: .sisyphus/evidence/task-13-lang-override.png
  ```

  **Commit**: YES (groups with Task 12)
  - Message: `feat(editor): add zoom, font, spaces, formatting, language override`

---

- [x] 14. 세션 자동저장 + 크래시 복구

  **What to do**:
  - `src/lib/session.svelte.ts` 생성 (Svelte 5 runes):
    - **세션 상태 구조**:
      - `SessionState` (Task 2 타입): version, activeTabId, tabs[], savedAt
      - Store 위치: `$APPDATA/session.json` (Tauri Store)
      - 백업 위치: `$APPDATA/backups/{tabId}.txt` (Tauri fs)
    - **Sentinel 파일 (크래시 감지)**:
      - 앱 시작: `$APPDATA/.wstext-running` 파일 생성
      - 앱 정상 종료: sentinel 파일 삭제
      - 다음 시작 시 sentinel 존재 → 이전 세션 비정상 종료 → 복구 모드
    - **2-Tier 자동저장**:
      - Tier 1 (메타데이터 — 5초): `Store.load('session.json', { autoSave: false })` + 5초 interval로 수동 save
        - 저장 내용: 열린 탭 목록, activeTabId, 각 탭의 cursor/scroll/encoding/language
        - file-backed 탭: content 제외 (디스크에서 재로드)
        - untitled 탭: content 포함
      - Tier 2 (콘텐츠 백업 — 30초): dirty 탭의 content를 `$APPDATA/backups/{tabId}.txt`에 atomic write
    - **종료 시 최종 저장**:
      - `getCurrentWindow().onCloseRequested()`: 이벤트 가로채기
      - dirty 탭 있으면 확인 다이얼로그 ("저장하지 않은 변경사항이 있습니다")
      - 세션 상태 최종 저장 + sentinel 삭제 + `getCurrentWindow().destroy()`
    - **복구 시퀀스 (앱 시작)**:
      1. sentinel 파일 확인 → 비정상 종료 여부
      2. `session.json` 로드
      3. 각 탭 복원:
         - file-backed: 디스크에서 재읽기 (파일 삭제됐으면 "File not found" 상태)
         - dirty tab: `backups/{tabId}.txt`에서 content 복원
         - untitled: session.json의 content에서 복원
      4. activeTab, cursor, scroll 복원
      5. sentinel 파일 생성 (새 세션 시작)
    - **에러 핸들링**:
      - session.json 파손 → 빈 세션으로 시작 (에러 무시)
      - backup 파일 파손 → 해당 탭 건너뛰기
      - AppData 디렉토리 없음 → 자동 생성

  **Must NOT do**:
  - Undo 히스토리 저장하지 않음
  - 파일 자동저장 (실제 파일에) 하지 않음
  - 멀티 인스턴스 충돌 처리하지 않음

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 가장 복잡한 기능. Sentinel 파일 + 2-tier 저장 + atomic write + 복구 시퀀스 + 에러 핸들링. 버그 있으면 데이터 손실.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 15, 16)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 4, 5, 10, 11

  **References**:

  **Pattern References**:
  - `src/lib/utils/atomicWrite.ts` (Task 4) — atomic write 유틸
  - `src/lib/stores/settings.svelte.ts` (Task 5) — Store 사용 패턴
  - `src/lib/stores/tabs.svelte.ts` (Task 11) — 탭 상태 접근
  - `src/lib/types.ts` (Task 2) — SessionState, TabState 타입

  **External References**:
  - Tauri `Store.load(path, { autoSave: false })` — 수동 저장 모드
  - Tauri `getCurrentWindow().onCloseRequested()` — 종료 이벤트 가로채기
  - Tauri `BaseDirectory.AppData` — 세션 데이터 저장 위치
  - Tauri `exists()`, `mkdir()` — 디렉토리 존재 확인 + 생성

  **WHY Each Reference Matters**:
  - `onCloseRequested` 빠뜨리면 종료 시 세션 저장 안 됨
  - atomic write 없으면 크래시 시 session.json 파손 위험
  - sentinel 파일 없으면 정상 종료 vs 크래시 구분 불가

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Session survives clean restart
    Tool: Playwright + Bash
    Steps:
      1. Open 3 files (file1.ts, file2.json, new untitled)
      2. Edit file1.ts, move cursor to line 50
      3. Edit untitled with 100 lines of text
      4. Close app via window X button
      5. Wait 2s
      6. Relaunch app
      7. Verify 3 tabs restored
      8. Verify file1.ts cursor at line 50
      9. Verify untitled content preserved (100 lines)
      10. Verify activeTab is same as before close
    Expected Result: Full session restoration
    Failure Indicators: Missing tabs, reset cursor, lost untitled content
    Evidence: .sisyphus/evidence/task-14-clean-restart.txt

  Scenario: Session survives force-kill (crash simulation)
    Tool: Bash + Playwright
    Steps:
      1. Launch app, open 2 files, edit both
      2. Wait 10s (ensure at least one auto-save cycle)
      3. Force-kill process: taskkill /F /IM wstext.exe (Windows) or kill -9 (Mac)
      4. Relaunch app
      5. Verify sentinel file detected (crash recovery mode)
      6. Verify tabs restored from last backup
      7. Verify maximum 30s of content loss (backup interval)
    Expected Result: Crash recovery works, data loss ≤30s
    Failure Indicators: Empty app on restart, corrupted session
    Evidence: .sisyphus/evidence/task-14-crash-recovery.txt

  Scenario: Corrupted session handling
    Tool: Bash + Playwright
    Steps:
      1. Manually corrupt $APPDATA/session.json (write garbage)
      2. Launch app
      3. Verify app starts without crash
      4. Verify empty session (no error dialog blocking)
    Expected Result: Graceful degradation, fresh start
    Evidence: .sisyphus/evidence/task-14-corrupt-session.txt
  ```

  **Commit**: YES
  - Message: `feat(session): implement session persistence and crash recovery`

---

- [x] 15. 메인 레이아웃 통합 + SublimeText 스타일링

  **What to do**:
  - `src/App.svelte` 전면 재구성:
    - 레이아웃: 상단 탭바 → 중앙 에디터 (+ 선택적 MD 프리뷰) → 하단 상태바
    - `TabBar` (Task 11) 상단 배치
    - Monaco Editor 중앙 (flex: 1)
    - `MarkdownPreview` (Task 8) 조건부 렌더링 (토글 또는 분할)
    - `StatusBar` (Task 7) 하단 고정
    - 빈 상태: 탭 없을 때 "Open a file (Ctrl+O) or create new (Ctrl+N)" 중앙 메시지
  - `src/app.css` 전면 스타일링:
    - SublimeText 느낌: 다크 배경, 얇은 탭바, 미니멀 상태바
    - 테마별 CSS 변수 시스템 (`--bg-primary`, `--bg-secondary`, `--fg-primary`, `--accent` 등)
    - `getThemeColors()` 결과를 CSS 변수로 바인딩
    - 모든 UI 요소 (탭바, 상태바, 프리뷰) 현재 테마 반영
    - 트랜지션: 테마 전환 시 0.15s ease 트랜지션
    - 윈도우 타이틀: `filename — wstext` / `filename* — wstext` (dirty) / `wstext` (empty)
  - 모든 컴포넌트 연결:
    - 메뉴 이벤트 → 파일 작업/줌/테마 전환
    - 에디터 커서 변경 → 상태바 업데이트
    - 탭 전환 → 에디터 model 스왑 + 상태바 업데이트
    - 설정 변경 → 에디터 옵션 즉시 반영
    - Todo mode → .md/.txt 파일에서 자동 활성화
    - MD preview → .md 파일에서 토글 버튼 표시
    - 언어 오버라이드 → 상태바 클릭 → 드롭다운 → 변경
    - 인코딩 변경 → 상태바 클릭 → 드롭다운 → 변경
    - Spaces 변경 → 상태바 클릭 → 2/4 선택

  **Must NOT do**:
  - 파일 트리 / 사이드바 추가하지 않음
  - 에디터 분할 패널 (마크다운 분할 외) 추가하지 않음
  - 커맨드 팔레트 추가하지 않음

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 전체 UI 통합 + CSS 스타일링 + 테마 시스템 + SublimeText 룩앤필 재현
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14, 16)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 3, 7, 8, 9, 11, 12, 13

  **References**:

  **Pattern References**:
  - `src/lib/components/TabBar.svelte` (Task 11) — 탭바 컴포넌트
  - `src/lib/components/StatusBar.svelte` (Task 7) — 상태바 컴포넌트
  - `src/lib/components/MarkdownPreview.svelte` (Task 8) — 프리뷰 컴포넌트
  - `src/lib/themes.ts` (Task 3) — getThemeColors
  - `src/lib/todo.ts` (Task 9) — 체크박스 데코레이션
  - `src/lib/zoom.ts` (Task 12) — 줌 핸들러
  - `src/lib/formatting.ts` (Task 13) — 포맷팅
  - `src/lib/languageOverride.ts` (Task 13) — 언어 변경

  **External References**:
  - SublimeText UI 참고: 다크 탭바, 미니멀 상태바, 미니맵
  - Tauri `getCurrentWindow().setTitle()` — 윈도우 타이틀 업데이트

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full editor layout matches SublimeText
    Tool: Playwright
    Steps:
      1. Launch app
      2. Verify layout: tab bar (top) + editor (center) + status bar (bottom)
      3. Open a .ts file → verify syntax highlighting + minimap visible
      4. Open a .md file → toggle preview → verify preview renders
      5. Switch theme to "dracula" → verify ALL UI elements change color
      6. Verify empty state message when no tabs open
      7. Screenshot full window
    Expected Result: SublimeText-like layout with working theme integration
    Evidence: .sisyphus/evidence/task-15-full-layout.png

  Scenario: All status bar interactions work
    Tool: Playwright
    Steps:
      1. Open a .json file
      2. Click language area in status bar → dropdown appears
      3. Select "YAML" → verify highlighting changes
      4. Click spaces area → select "2" → verify tabSize changes
      5. Verify line:col updates on cursor move
    Expected Result: Status bar is fully interactive
    Evidence: .sisyphus/evidence/task-15-statusbar-interaction.png
  ```

  **Commit**: YES
  - Message: `feat(layout): integrate all components with SublimeText styling`

---

- [x] 16. 엣지 케이스 처리 (바이너리, 대용량, 빈 상태, 탭 오버플로우 등)

  **What to do**:
  - **바이너리 파일**: openFile 시 `isBinaryFile()` 체크 → "이 파일은 바이너리 파일입니다. 표시할 수 없습니다." 메시지
  - **대용량 파일 (>5MB)**: 경고 표시 + 미니맵 비활성화 + 구문 강조 간소화
  - **대용량 파일 (>50MB)**: 열기 거부 + "파일이 너무 큽니다 (50MB 초과)" 메시지
  - **빈 상태 (탭 없음)**: 중앙 안내 메시지 + 키보드 단축키 힌트 (Open: Ctrl+O, New: Ctrl+N)
  - **확장자 없는 파일**: language = 'plaintext', 수동 변경 가능
  - **빈 파일 (0 bytes)**: 정상 열기, 빈 에디터
  - **존재하지 않는 파일 경로 (세션 복구 시)**: "File not found" 상태 표시, 크래시 방지
  - **디스크 풀 에러**: 저장 실패 시 명확한 에러 메시지 + "다른 이름으로 저장" 제안
  - **읽기 전용 파일**: 저장 실패 시 "다른 이름으로 저장" 제안
  - **Ctrl+S on untitled**: Save As 다이얼로그 트리거
  - **Ctrl+S on no tabs**: 무시 (에러 없음)
  - **윈도우 리사이즈**: Monaco `automaticLayout: true` + 마크다운 분할 비율 유지
  - **유니코드 파일 경로 (한글, 日本語)**: Tauri v2 기본 지원 확인

  **Must NOT do**:
  - 파일 워칭 (외부 변경 감지) 구현하지 않음
  - 라인 엔딩 변환 (CRLF↔LF) 구현하지 않음
  - 동시 다중 인스턴스 충돌 처리하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 다양한 엣지 케이스 각각에 대한 방어적 코딩
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14, 15)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 4, 10, 11

  **References**:

  **Pattern References**:
  - `src/lib/utils/binaryDetection.ts` (Task 4) — isBinaryFile
  - `src/lib/fileOps.svelte.ts` (Task 10) — 파일 열기/저장
  - `src/lib/stores/tabs.svelte.ts` (Task 11) — 탭 상태

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Binary file rejected with message
    Tool: Playwright
    Steps:
      1. Try to open a .exe or .png file
      2. Verify error message appears (not editor content)
      3. Verify no tab created
    Expected Result: Clean rejection with message
    Evidence: .sisyphus/evidence/task-16-binary-reject.png

  Scenario: Empty state shows guidance
    Tool: Playwright
    Steps:
      1. Close all tabs
      2. Verify center message visible: contains "Ctrl+O" and "Ctrl+N"
      3. Press Ctrl+N
      4. Verify new tab created, message disappears
    Expected Result: Helpful empty state
    Evidence: .sisyphus/evidence/task-16-empty-state.png

  Scenario: Unicode file path works
    Tool: Bash + Playwright
    Steps:
      1. Create file at path with Korean characters: echo "테스트" > "/tmp/한글파일.txt"
      2. Open file in app
      3. Verify content "테스트" displayed correctly
      4. Verify tab title shows "한글파일.txt"
    Expected Result: Unicode paths handled correctly
    Evidence: .sisyphus/evidence/task-16-unicode-path.txt
  ```

  **Commit**: YES
  - Message: `fix(edge): handle binary files, large files, empty state, unicode paths`

---

- [x] 17. 크로스 플랫폼 빌드 + 최종 폴리시

  **What to do**:
  - **Windows 빌드**:
    - `npm run tauri build` → .msi 인스톨러 생성 확인
    - `src-tauri/tauri.conf.json` bundle 설정: `"targets": ["msi", "nsis"]`
    - 앱 아이콘 설정 (기본 Tauri 아이콘 또는 간단한 커스텀)
  - **Mac 빌드**:
    - `npm run tauri build` → .dmg 생성 확인
    - `src-tauri/tauri.conf.json` bundle: `"targets": ["dmg", "app"]`
    - Info.plist 설정: 파일 연결 (txt, md, json, yaml 등)
  - **최종 폴리시**:
    - 모든 `console.log` 프로덕션 코드에서 제거
    - 모든 TODO/FIXME 코멘트 해결 또는 제거
    - 앱 타이틀/버전 확인
    - CSP (Content Security Policy) 확인 — Monaco가 동작하는 범위에서 최대한 제한
    - README.md 업데이트: 프로젝트 설명, 스크린샷, 빌드 방법
  - **빌드 테스트**:
    - Windows에서 `npm run tauri build` 성공
    - 빌드된 바이너리 실행 → 기본 기능 동작 확인

  **Must NOT do**:
  - CI/CD 파이프라인 구축하지 않음
  - 자동 업데이트 메커니즘 추가하지 않음
  - 코드 서명 설정하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 빌드 설정 + 폴리시 + 크로스 플랫폼 검증
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (solo)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 14, 15, 16

  **References**:

  **External References**:
  - Tauri build: `npm run tauri build` — 플랫폼별 번들 생성
  - Tauri bundle config: `tauri.conf.json` → `bundle.targets`
  - Tauri icons: `src-tauri/icons/` — 각 플랫폼별 아이콘

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Windows build succeeds
    Tool: Bash
    Steps:
      1. Run `npm run tauri build`
      2. Verify exit code 0
      3. Verify .msi file exists in src-tauri/target/release/bundle/msi/
      4. Check file size (should be 10-30MB range)
    Expected Result: .msi installer produced
    Evidence: .sisyphus/evidence/task-17-windows-build.txt

  Scenario: Built app works
    Tool: Bash + Playwright
    Steps:
      1. Install .msi (silent)
      2. Launch installed app
      3. Open a file, edit, save
      4. Close and reopen → verify session restored
      5. Verify all themes work
      6. Verify markdown preview works
    Expected Result: Production build fully functional
    Evidence: .sisyphus/evidence/task-17-production-test.txt
  ```

  **Commit**: YES
  - Message: `build: configure cross-platform build for Windows and macOS`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read files, check functionality). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run check` (svelte-check) + `npm run tauri build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod code, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic variable names.
  Output: `Build [PASS/FAIL] | Check [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration: open file → edit → switch tab → zoom → toggle theme → save → force-kill → restart → verify recovery. Test edge cases: empty file, binary file, 10MB file, UTF-16 file, no-extension file. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual code. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT Have" compliance: no file tree, no command palette, no multi-window, no LSP. Flag unaccounted features.
  Output: `Tasks [N/N compliant] | Guardrails [N/N clean] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task | Commit Message | Key Files |
|-----------|---------------|-----------|
| 1 | `feat: scaffold Tauri v2 + Svelte 5 + Monaco editor` | package.json, vite.config.ts, src-tauri/*, src/* |
| 3+4+5 | `feat(core): add themes, utilities, and settings store` | src/lib/themes.ts, src/lib/utils/*, src/lib/stores/* |
| 6+7 | `feat(ui): add app menu, shortcuts, and status bar` | src/lib/menu.ts, src/lib/components/StatusBar.svelte |
| 8+9 | `feat(modes): add markdown preview and todo mode` | src/lib/components/MarkdownPreview.svelte, src/lib/todo.ts |
| 10 | `feat(files): implement file operations with encoding support` | src/lib/fileOps.svelte.ts |
| 11 | `feat(tabs): implement multi-tab with model swap and dirty tracking` | src/lib/tabs.svelte.ts, src/lib/components/TabBar.svelte |
| 12+13 | `feat(editor): add zoom, font, spaces, formatting, language override` | src/lib/stores/settings.svelte.ts |
| 14 | `feat(session): implement session persistence and crash recovery` | src/lib/session.svelte.ts |
| 15 | `feat(layout): integrate all components with SublimeText styling` | src/App.svelte, src/app.css |
| 16 | `fix(edge): handle binary files, large files, empty state, tab overflow` | src/lib/utils/*, src/lib/components/* |
| 17 | `build: configure cross-platform build for Windows and macOS` | src-tauri/tauri.conf.json, .github/workflows/* |

---

## Success Criteria

### Verification Commands
```bash
npm run tauri dev       # Expected: app launches, Monaco renders, can type text
npm run tauri build     # Expected: builds .msi (Windows) or .dmg (Mac) successfully
npm run check           # Expected: svelte-check passes with 0 errors
```

### Final Checklist
- [ ] All 11 "Must Have" features present and functional
- [ ] All 16 "Must NOT Have" items absent from codebase
- [ ] Session survives force-kill and restart
- [ ] UTF-16 LE file round-trips without corruption
- [ ] 5 themes switch correctly
- [ ] JSON/YAML formatting works
- [ ] Markdown preview renders correctly
- [ ] Todo checkboxes toggle
- [ ] Ctrl+mousewheel zooms
- [ ] Status bar shows line:col, language, encoding, spaces
- [ ] Windows .msi and Mac .dmg build successfully
