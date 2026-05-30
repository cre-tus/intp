# 🗺️ INTP (Intelligent Navigation & Trip Planner)

INTP(인팁)는 고도화된 여행 경로 최적화 및 스마트한 일정 관리를 지원하는 지능형 여행 계획 플랫폼(Intelligent Navigation & Trip Planner)입니다. 사용자 중심의 현대적이고 세련된 UX/UI 시스템을 기반으로 직관적인 지도 인터페이스, 양방향 드래그 앤 드롭 일정 관리, 그리고 실시간 엑셀형 계획 템플릿을 제공합니다.

---

## ✨ 주요 기능 (Key Features)

### 1. 스마트 일정 재정렬 시스템 (Smart Reordering System)
- **데스크톱 및 모바일 최적화**: 
  - 마우스 드래그 앤 드롭(`@dnd-kit`)을 통한 자유로운 일정 위치 수정이 가능합니다.
  - **모바일 원터치 조작 UX**: 모바일 화면에서 순서 숫자를 가볍게 탭하면 위/아래 이동을 선택할 수 있는 세련된 **글래스모피즘 컨텍스트 팝오버 메뉴**를 제공하여 손쉬운 정렬이 가능합니다.
  - 모바일 터치 오동작 및 드래그-스크롤 충돌을 원천 방지하기 위해 터치 미세 감도 보정 센서 필터가 적용되어 있습니다.

### 2. 다중 스타일 계획 템플릿 (Multi-Template Planning)
- **일반형 템플릿 (Basic Itinerary)**: 동적 시간 및 카드 배치 뷰어.
- **엑셀 스프레드시트 템플릿 (Excel Spreadsheet)**: 열(Day)과 행(일정/식비)을 한눈에 보며 대량의 정보를 직관적으로 기입 및 합산할 수 있는 오피스형 인터페이스.

### 3. 실시간 다크 모드 & 테마 통합 로고 (Modern Dark Mode)
- **옵시디언 다크 테마**: 저조도 환경에서도 눈이 편안한 트렌디한 다크 스킨 시스템이 통합되어 있습니다.
- **유기적 로고 이미지 스위처**: 
  - 라이트 모드에서는 부드러운 파스텔 그라데이션 기반의 `icon.svg`가 활성화됩니다.
  - 다크 모드에서는 깊이감 있는 어두운 슬레이트 바탕의 `icon_dark.svg`가 렌더링됩니다.
  - 서버 사이드 렌더링(SSR) 수분 공급 불일치(Hydration Mismatch) 현상 및 테마 로딩 깜빡임이 발생하지 않도록 순수 CSS 결합형 로직으로 처리되어 있습니다.

### 4. 고도화된 경로 최적화 (Route Optimization)
- **공간 분석 통합**: PostGIS 및 오픈스트리트맵(OSM) 연동을 통하여 실제 공간 좌표에 기반한 정밀한 여행 경로 계산 및 최적 경로 렌더링을 제공합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **Core**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4, PostCSS
- **State Management**: Zustand
- **Interactions**: @dnd-kit (Core, Sortable, Utilities), Lucide React (Icons)

### Backend
- **Core Framework**: Spring Boot
- **Language**: Java

### Web Server & Infrastructure
- **Reverse Proxy / Static Hosting**: Nginx
- **Containerization**: Docker, Docker Compose

### Database & Cache
- **Spatial Data / Main Relational DB**: PostGIS, MySQL
- **NoSQL Documents**: MongoDB
- **Performance Cache / Session Storage**: Redis

---

## 🚀 시작하기 (Getting Started)

### 프론트엔드 로컬 개발 환경 실행 (Frontend Setup)

1. **의존성 모듈 설치**
   ```bash
   cd frontend
   npm install
   ```

2. **개발용 데브 서버 구동**
   ```bash
   npm run dev
   ```
   브라우저에서 `http://localhost:3000`으로 접속하여 확인합니다.

3. **프로덕션 빌드**
   ```bash
   npm run build
   npm start
   ```
---

## 📄 오픈소스 및 라이선스 고지 (Open Source Acknowledgements)

본 프로젝트는 서비스 품질 및 정밀한 지리 공간 분석을 위해 아래 오픈소스 데이터와 라이브러리를 공식적으로 사용합니다.

- **OpenStreetMap (OSM)**
  - © OpenStreetMap 기여자
  - [https://www.openstreetmap.org/](https://www.openstreetmap.org/)
  - ODbL(오픈 데이터베이스 라이선스)에 의거하여 데이터를 활용합니다.
- **ODPT (일본 대중교통 오픈데이터 센터)**
  - [https://www.odpt.org/](https://www.odpt.org/)
  - 일본 대중교통 노선 시간표 및 실시간 데이터 조회 목적으로 활용 중입니다.
  - 데이터 제공처는 정보의 실시간 무결성이나 정밀도를 100% 보증하지 않습니다.
