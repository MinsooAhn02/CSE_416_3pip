## QMD 설정 (처음 한 번만)

### 1. 설치
npm install -g @tobilu/qmd

### 2. MCP 글로벌 등록
claude mcp add qmd node --scope user -- "%APPDATA%\npm\node_modules\@tobilu\qmd\dist\cli\qmd.js" mcp

## 새 프로젝트마다

cd your-project
qmd collection add . --name your-project
qmd embed  # 첫 실행 시 모델 다운로드 (~330MB, 약 30초)