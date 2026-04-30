<p align="center">
  <img src="static/wstext-icon.png" width="128" height="128" alt="WSText" />
</p>

<h1 align="center">WSText</h1>

<p align="center">
  <strong>네이티브 투두 체크박스와 마크다운 프리뷰를 갖춘 가볍고 빠른 텍스트 에디터.</strong>
</p>

<p align="center">
  Tauri v2 + Svelte 5 + Monaco Editor 기반.<br/>
  Sublime Text에서 영감을 받아 — 핵심 기능만, 군더더기 없이.
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center">
  <img src="static/screenshot.png" alt="WSText Screenshot" width="800" />
</p>

---

## 주요 기능

**기본**
- 가벼운 네이티브 데스크톱 앱 (~10MB 설치파일)
- 멀티탭 편집 + 세션 자동 복원
- Ctrl+마우스휠 줌, 자동 줄바꿈, 미니맵
- 드래그 앤 드롭 파일 열기, 최근 파일 목록
- 파일 인코딩 자동 감지 (UTF-8, UTF-16 LE/BE, Latin-1)

**네이티브 투두 체크박스**
- `[]` 입력하면 체크박스 `☐`로 자동 변환
- 클릭 또는 `Ctrl+Enter`로 체크 토글 `☑`
- 체크된 항목은 반투명하게 표시
- 여러 줄 선택 후 `Ctrl+Enter`로 일괄 토글
- 파일 저장 시 표준 `[ ]` / `[x]` 형식으로 변환 — 어디서든 호환

**마크다운 프리뷰**
- 분할 뷰: 에디터 + 실시간 프리뷰 나란히
- 상태바 버튼 또는 `Ctrl+Shift+M`으로 토글
- `.md` 파일은 자동으로 분할 뷰로 열림
- 코드 블록 구문 강조, 테이블, 태스크 리스트 지원

**커스터마이즈**
- 5가지 내장 테마 (One Dark, Monokai, Dracula, Solarized Dark/Light)
- 시스템 폰트 선택기 (한글 폰트 지원)
- [Pretendard](https://github.com/orioncactus/pretendard) 폰트 내장
- 설정 다이얼로그: 일반 / 폰트 / 테마

## 설치

[Releases](../../releases) 페이지에서 최신 버전을 다운로드하세요:

| 플랫폼 | 파일 | 비고 |
|--------|------|------|
| Windows (설치형) | `WSText_x.x.x_x64-setup.exe` | 권장. 자동 업데이트 포함. |
| Windows (포터블) | `WSText-portable.exe` | 설치 불필요. 업데이트 알림만 표시. |
| macOS | `WSText_x.x.x_aarch64.dmg` | Apple Silicon. 자동 업데이트 포함. **아래 안내 참고.** |

앱 시작 시 자동으로 최신 버전을 확인하고, 새 버전이 있으면 알려줍니다.

### macOS: "손상되어 열 수 없다"는 메시지가 뜰 때

현재 macOS 빌드는 **Apple Developer 인증서로 서명되어 있지 않습니다**. 다운로드 후 열려고 하면 다음 메시지가 뜰 수 있습니다:

> "WSText"이(가) 손상되어 열 수 없습니다. 휴지통으로 이동해야 합니다.

실제로 앱이 손상된 게 **아닙니다** — macOS Gatekeeper가 인터넷에서 받은 미서명 앱을 차단하는 것뿐입니다. 다운로드 시 macOS가 붙인 quarantine 속성을 제거하면 정상 실행됩니다:

1. `.dmg`를 열어 `WSText.app`을 `/Applications`로 드래그하세요.
2. 터미널을 열고 다음 명령 실행:
   ```bash
   xattr -cr /Applications/WSText.app
   ```
   그래도 안 되면:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/WSText.app
   ```
3. Launchpad 또는 응용 프로그램 폴더에서 WSText를 정상적으로 실행하세요.

이 작업은 설치당 한 번만 하면 됩니다. 정식 코드 서명 + 공증은 로드맵에 있습니다.

## 단축키

| 동작 | 단축키 |
|------|--------|
| 새 파일 | `Ctrl+N` |
| 파일 열기 | `Ctrl+O` |
| 저장 | `Ctrl+S` |
| 다른 이름으로 저장 | `Ctrl+Shift+S` |
| 탭 닫기 | `Ctrl+W` |
| 모든 탭 닫기 | `Ctrl+Shift+W` |
| 체크박스 토글 | `Ctrl+Enter` |
| 프리뷰 토글 | `Ctrl+Shift+M` |
| 확대/축소 | `Ctrl+마우스 휠` |
| 다음/이전 탭 | `Ctrl+Tab` / `Ctrl+Shift+Tab` |

## 소스에서 빌드

**필수 조건**: Node.js 20+, Rust, 플랫폼 빌드 도구 ([Tauri 사전 요구사항](https://v2.tauri.app/start/prerequisites/))

```bash
# 의존성 설치
npm install

# 개발 모드
npm run tauri dev

# 릴리즈 빌드
npm run tauri build
```

## 로드맵

- [x] 프로젝트 모드 — 여러 파일/폴더를 한 번에 관리
- [ ] macOS 코드 서명 & 공증
- [ ] 플러그인 시스템
- [ ] Linux 지원

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 런타임 | [Tauri v2](https://v2.tauri.app) |
| 프론트엔드 | [Svelte 5](https://svelte.dev) |
| 에디터 | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| 마크다운 | [marked](https://marked.js.org) + [highlight.js](https://highlightjs.org) |
| 폰트 | [Pretendard](https://github.com/orioncactus/pretendard) |

## 라이선스

이 프로젝트는 [GNU Affero General Public License v3.0](LICENSE) 라이선스 하에 배포됩니다.
