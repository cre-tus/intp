# INTP 여행 플래너 모듈 명세서

## 1. 문서 개요

본 문서는 INTP 여행 플래너 프로젝트의 주요 모듈 구조, 책임, 인터페이스, 데이터 흐름을 정리한 모듈 명세서이다. 대상 범위는 현재 코드베이스 기준의 Spring Boot 백엔드, Next.js 프론트엔드, Docker 기반 인프라 구성을 포함한다.

## 2. 시스템 개요

INTP 여행 플래너는 사용자가 여행 일정표를 생성하고, Day별 장소를 입력하며, 참여자와 함께 계획을 편집할 수 있는 웹 애플리케이션이다. 장소 검색은 Nominatim 기반 자동완성을 사용하고, 좌표가 있는 장소는 GTFS 정류장 데이터 기반으로 주변 대중교통 정보와 경로 최적화 결과를 제공한다.

### 주요 기능

- 로그인, 로그아웃, 내 정보 조회
- 여행 계획 생성 및 링크 기반 참여
- 체크리스트, Day별 일정, 장소/시간/활동/비용 입력
- 참여자 이메일 기반 초대 및 접근 제한
- WebSocket 기반 여행 계획 실시간 동기화
- 좌표 주변 대중교통 정류장 조회
- N개 목적지 간 비용 행렬 생성
- N <= 5 목적지 대상 Brute-force TSP 최적화
- 마이페이지에서 내 로컬 여행 계획 이어서 작업

## 3. 기술 스택

### Backend

- Java 17
- Spring Boot 4.0.1
- Spring Web MVC
- Spring WebFlux WebClient
- Spring Security
- Spring WebSocket
- Spring Data JPA
- Spring Data Redis
- MySQL
- PostGIS PostgreSQL
- JWT

### Frontend

- Next.js 16.1.1
- React 19.2.3
- TypeScript
- Tailwind CSS
- Zustand
- Axios
- DnD Kit
- Lucide React

### Infra

- Docker Compose
- MySQL 8.0
- Redis 7
- PostGIS 16
- Nginx reverse proxy
- Nominatim
- Tileserver GL

## 4. 백엔드 모듈 명세

## 4.1 인증 모듈

### 패키지

- `com.infp.auth`
- `com.infp.user`

### 책임

- 이메일/비밀번호 로그인 처리
- JWT accessToken, refreshToken 발급
- HttpOnly 쿠키 기반 인증 상태 유지
- 로그아웃 시 refreshToken 무효화 및 쿠키 삭제
- `/api/auth/me`를 통한 현재 로그인 사용자 정보 제공
- JWT 필터를 통해 Spring Security `AuthenticationPrincipal` 주입

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `AuthController` | 로그인, 로그아웃, 내 정보 API 제공 |
| `AuthService` | 사용자 검증, 토큰 생성/무효화 처리 |
| `JwtTokenProvider` | JWT 생성 및 파싱 |
| `JwtAuthFilter` | 요청 쿠키의 JWT 검증 및 인증 객체 설정 |
| `User` | 사용자 JPA 엔티티 |
| `UserRepository` | 사용자 조회 Repository |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 로그인 후 accessToken, refreshToken 쿠키 발급 |
| `POST` | `/api/auth/logout` | 로그아웃 및 인증 쿠키 삭제 |
| `GET` | `/api/auth/me` | 현재 로그인 사용자 ID, 이메일, 닉네임 조회 |

### 입력/출력

`POST /api/auth/login`

```json
{
  "email": "test@infp.com",
  "password": "password",
  "rememberMe": true
}
```

`GET /api/auth/me`

```json
{
  "id": 1,
  "email": "test@infp.com",
  "nickname": "개발자"
}
```

## 4.2 장소 검색 모듈

### 패키지

- `com.infp.place`

### 책임

- 사용자가 입력한 장소 키워드를 Nominatim API에 전달
- 검색어 변형 및 자동완성 후보 생성
- 장소명, 주소, 좌표, 중요도 정보를 프론트엔드에 반환

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlaceController` | 장소 자동완성 API 제공 |
| `PlaceAutocompleteService` | 검색어 처리 및 응답 변환 |
| `NominatimClient` | Nominatim 외부 API 호출 |
| `PlaceItem` | 장소 자동완성 응답 DTO |
| `QueryVariantBuilder` | 검색어 변형 생성 |
| `Geo` | 좌표 관련 유틸리티 |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET` | `/api/place/autocomplete?q={keyword}` | 장소 자동완성 후보 조회 |

### 출력 예시

```json
[
  {
    "id": "place:1725829",
    "title": "上野公園",
    "subtitle": "上野公園, 台東区, 東京都, 日本",
    "lat": 35.714,
    "lon": 139.7739,
    "importance": 0.08,
    "sourceQuery": "우에노공원"
  }
]
```

## 4.3 경로 최적화 및 대중교통 모듈

### 패키지

- `com.infp.route`

### 책임

- 좌표 기준 주변 GTFS 정류장 조회
- 목적지 간 이동 비용 행렬 생성
- N <= 5 목적지를 대상으로 Brute-force TSP 최적 순서 계산
- 수동 순서와 최적 순서 비교
- 각 장소별 가장 가까운 정류장 정보 제공

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `RouteOptimizationController` | 경로 최적화 REST API 제공 |
| `RouteOptimizationService` | 비용 행렬 생성, TSP 순열 탐색, 응답 조립 |
| `GtfsTransitService` | GTFS 정류장 로딩, 근처 정류장 조회, 비용 추정 |
| `RoutePoint` | 목적지 좌표 DTO |
| `TransitStop` | 정류장 정보 DTO |
| `RouteLeg` | 구간별 이동 정보 DTO |
| `RouteOptimizationResponse` | 최적화 결과 DTO |
| `RouteCostMatrixResponse` | 비용 행렬 결과 DTO |
| `RouteCompareResponse` | 수동/최적 경로 비교 결과 DTO |

### 비용 모델

현재 비용 모델은 실제 환승 경로 탐색이 아니라 GTFS 정류장 기반 추정 모델이다.

계산 방식:

1. 출발지에서 가장 가까운 정류장 탐색
2. 도착지에서 가장 가까운 정류장 탐색
3. 출발지-출발 정류장 도보 시간 계산
4. 정류장 간 직선거리 기반 대중교통 이동 시간 계산
5. 도착 정류장-도착지 도보 시간 계산
6. 기본 탑승 대기 시간 6분 추가

상수:

| 항목 | 값 |
| --- | --- |
| 도보 속도 | 4.8km/h |
| 대중교통 평균 속도 | 32.0km/h |
| 탑승 대기 시간 | 6분 |
| 최적화 최대 목적지 수 | 5개 |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/routes/optimize` | 목적지 목록의 최적 방문 순서 계산 |
| `POST` | `/api/routes/compare` | 수동 순서와 최적 순서 비교 |
| `POST` | `/api/routes/cost-matrix` | 목적지 간 시간/거리 비용 행렬 생성 |
| `GET` | `/api/routes/stops/nearby` | 특정 좌표 주변 정류장 조회 |

### `POST /api/routes/optimize` 요청 예시

```json
{
  "points": [
    {
      "id": "a1",
      "name": "上野公園",
      "lat": 35.714,
      "lon": 139.7739,
      "originalIndex": 0
    },
    {
      "id": "a2",
      "name": "東京駅",
      "lat": 35.6812,
      "lon": 139.7671,
      "originalIndex": 1
    }
  ]
}
```

### 응답 주요 필드

| 필드 | 설명 |
| --- | --- |
| `optimizedOrder` | 최적 방문 순서 |
| `legs` | 각 구간별 출발지, 도착지, 거리, 시간, 근처 정류장 |
| `minutesMatrix` | 목적지 간 이동 시간 행렬 |
| `distanceMatrix` | 목적지 간 이동 거리 행렬 |
| `nearestStops` | 각 목적지의 가장 가까운 정류장 |
| `totalDistanceKm` | 총 이동 거리 |
| `totalMinutes` | 총 이동 시간 |
| `elapsedMillis` | 최적화 계산 시간 |
| `costModel` | 비용 모델 설명 |

### `GET /api/routes/stops/nearby` 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `lat` | number | 필수 | 위도 |
| `lon` | number | 필수 | 경도 |
| `radiusMeters` | number | 800 | 검색 반경 |
| `limit` | number | 8 | 최대 반환 개수 |

## 4.4 여행 계획 협업 모듈

### 패키지

- `com.infp.plan.collaboration`

### 책임

- 특정 여행 계획의 참여자 목록 조회
- 이메일 기반 참여자 추가
- 참여자 역할 변경
- 참여자 제거
- 참여자 접근 권한 검증

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlanCollaborationController` | 참여자 관리 REST API 제공 |
| `PlanCollaborationService` | 참여자 권한 검증 및 DB 조작 |
| `PlanParticipantDto` | 참여자 응답 DTO |
| `AddPlanParticipantRequest` | 참여자 추가 요청 DTO |
| `UpdatePlanParticipantRoleRequest` | 역할 변경 요청 DTO |

### 역할

| 역할 | 설명 |
| --- | --- |
| `OWNER` | 계획 소유자. 제거 및 일반 API 역할 변경 불가 |
| `EDITOR` | 일정 편집 및 참여자 관리 가능 |
| `VIEWER` | 조회 권한. 참여자 관리 불가 |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET` | `/api/plans/{planId}/participants` | 참여자 목록 조회 |
| `POST` | `/api/plans/{planId}/participants` | 참여자 추가 |
| `PATCH` | `/api/plans/{planId}/participants/{userId}` | 참여자 역할 변경 |
| `DELETE` | `/api/plans/{planId}/participants/{userId}` | 참여자 제거 |

### 제약 사항

- 참여자 목록 조회는 해당 계획의 ACTIVE 참여자만 가능하다.
- 참여자 추가/수정/삭제는 OWNER 또는 EDITOR만 가능하다.
- OWNER 역할은 참여자 추가 API로 부여할 수 없다.
- OWNER 사용자는 제거할 수 없다.
- 이메일은 활성 사용자(`users.status = ACTIVE`)와 매칭되어야 한다.

## 4.5 실시간 동기화 모듈

### 패키지

- `com.infp.plan.realtime`

### 책임

- 계획 ID별 WebSocket 세션 그룹 관리
- 같은 계획을 보고 있는 사용자에게 변경 메시지 브로드캐스트
- 최신 메시지 스냅샷을 메모리에 보관
- 새로 접속한 사용자에게 최신 스냅샷 전달

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlanRealtimeWebSocketConfig` | `/ws/plans/{planId}` WebSocket 핸들러 등록 |
| `PlanRealtimeWebSocketHandler` | 세션 관리, 메시지 저장, 브로드캐스트 처리 |

### WebSocket Endpoint

```text
ws://{host}/ws/plans/{planId}
```

### 메시지 형식

```json
{
  "type": "PLAN_UPDATED",
  "clientId": "browser-client-uuid",
  "editorName": "개발자",
  "editorEmail": "test@infp.com",
  "updatedAt": "2026-05-18T00:00:00.000Z",
  "plan": {
    "id": "plan-id",
    "title": "신규 여행 일정표",
    "template": "basic",
    "checklist": [],
    "participants": [],
    "days": [],
    "createdAt": "2026-05-18T00:00:00.000Z",
    "updatedAt": "2026-05-18T00:00:00.000Z"
  }
}
```

### 동기화 정책

- 입력 중에는 프론트엔드 localStorage에만 저장한다.
- 입력칸 blur, Enter, 버튼 클릭, 저장하기 버튼 등 작성 완료 시점에 WebSocket 메시지를 전송한다.
- 수신자는 같은 `clientId`의 메시지를 무시하여 자기 메시지를 다시 적용하지 않는다.
- 서버는 최신 메시지를 `latestMessageByPlanId`에 보관하고, 새 접속자에게 즉시 전달한다.

## 4.6 전역 설정 모듈

### 패키지

- `com.infp.global`

### 책임

- Spring Security 설정
- CORS 및 웹 설정
- WebClient Bean 구성
- 전역 예외 응답 처리

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `SecurityConfig` | 인증 필터 등록 및 요청 접근 정책 설정 |
| `SecurityBeans` | 보안 관련 Bean 제공 |
| `WebConfig` | CORS 등 웹 MVC 설정 |
| `WebClientConfig` | 외부 API 호출용 WebClient 설정 |
| `GlobalExceptionHandler` | 예외를 HTTP 응답으로 변환 |

## 5. 프론트엔드 모듈 명세

## 5.1 라우팅 모듈

### 경로

- `frontend/app`

### 페이지

| 파일 | URL | 설명 |
| --- | --- | --- |
| `app/page.tsx` | `/` | 홈 화면 |
| `app/login/page.tsx` | `/login` | 로그인 화면 |
| `app/createplan/page.tsx` | `/createplan` | 기본 계획 작성 화면 |
| `app/createplan/[createid]/page.tsx` | `/createplan/{createid}` | 특정 계획 ID 기반 작성 화면 |
| `app/mypage/page.tsx` | `/mypage` | 내 여행 계획 목록 |

## 5.2 홈 모듈

### 경로

- `frontend/components/home`

### 책임

- 서비스 첫 화면 표시
- 계획 생성 버튼 제공
- 초대 링크/계획 ID를 통한 참여 기능 제공

### 주요 컴포넌트

| 컴포넌트 | 책임 |
| --- | --- |
| `HeroSection` | 홈 메인 콘텐츠 구성 |
| `PrimaryButton` | 템플릿 선택 모달 및 신규 계획 생성 |
| `SecondaryButton` | 초대 링크/계획 ID 입력 후 계획 참여 |
| `TypingText` | 홈 화면 타이핑 문구 표시 |
| `MovingRow` | 홈 비주얼 영역 표시 |

### 생성 정책

- 생성 버튼 클릭 시 기본 템플릿을 사용한다.
- `generatePlanId()`로 UUID 기반 계획 ID를 생성한다.
- 로그인 사용자가 있으면 자동으로 참여자 목록에 OWNER로 추가한다.
- 생성 후 `/createplan/{id}`로 이동한다.

## 5.3 여행 계획 편집 모듈

### 경로

- `frontend/components/planner`

### 책임

- 여행 계획 전체 편집 화면 구성
- 체크리스트, Day별 일정, 참여자, 저장, 지도 경로 패널을 통합
- localStorage 기반 임시 저장
- WebSocket 기반 협업 동기화
- 참여자 이메일 기반 접근 제한

### 주요 컴포넌트

| 컴포넌트 | 책임 |
| --- | --- |
| `HeroSection` | 여행 계획 편집 화면의 상태 관리 및 동기화 |
| `TravelCheckList` | 여행 전 준비물 및 비용 입력 |
| `TravelItinerary` | Day별 일정 관리 |
| `SortableDayCard` | Day 단위 드래그 정렬 |
| `SortableActivityRow` | 일정 항목 단위 드래그 정렬 |
| `ActivityRow` | 일정 한 줄 UI 구성 |
| `PlaceSerachInput` | 장소 자동완성 입력 |
| `PlaceSerachModal` | 장소 후보 목록 표시 |
| `MapRoutePanel` | Day별 지도, 근처 정류장, TSP 최적화 결과 표시 |
| `ParticipantsSidebar` | 참여자 목록, 이메일 추가, 초대 링크 복사 |
| `SaveSection` | 명시적 저장 버튼 및 저장 정보 표시 |

### 상태 구조

`TravelPlanDraft`

```ts
type TravelPlanDraft = {
  id: string;
  title: string;
  template: "basic";
  checklist: ChecklistItem[];
  days: ItineraryDay[];
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
};
```

`ItineraryDay`

```ts
type ItineraryDay = {
  id: string;
  date: string;
  dayTitle: string;
  activities: ItineraryActivity[];
};
```

`ItineraryActivity`

```ts
type ItineraryActivity = {
  id: string;
  time: string;
  location: string;
  activity: string;
  cost: number;
  placeId?: string;
  placeSubtitle?: string;
  lat?: number;
  lon?: number;
};
```

### 접근 제한 정책

- 참여자 이메일 목록이 비어 있으면 접근 제한을 적용하지 않는다.
- 참여자 이메일 목록이 존재하면 현재 로그인 사용자 이메일이 목록에 있어야 화면 접근이 가능하다.
- 빈 계획에 로그인 사용자가 진입하면 자동으로 OWNER 참여자로 추가된다.

### 실시간 전송 정책

- 입력 중에는 WebSocket 전송을 하지 않는다.
- localStorage 저장은 500ms 지연 후 수행한다.
- 다음 이벤트에서만 실시간 동기화를 전송한다.
  - 입력 blur
  - Enter 입력
  - 버튼 클릭
  - 저장하기 클릭

## 5.4 경로 패널 모듈

### 컴포넌트

- `MapRoutePanel`

### 책임

- Day1, Day2 등 특정 Day를 선택하여 해당 Day의 경로만 표시
- 선택된 Day 안에서 좌표가 있는 장소만 추출
- 각 장소별 근처 정류장 표시
- TSP 최적화 실행
- 수동 경로와 최적 경로 비교
- 초기화 기능 제공

### 백엔드 연동

| 기능 | API |
| --- | --- |
| 근처 정류장 조회 | `GET /api/routes/stops/nearby` |
| 비용 행렬 조회 | `POST /api/routes/cost-matrix` |
| TSP 최적화 | `POST /api/routes/optimize` |
| 경로 비교 | `POST /api/routes/compare` |

### 제약 사항

- 선택된 Day에 좌표가 있는 장소가 2개 이상이어야 경로 계산이 가능하다.
- 최적화 대상 목적지는 최대 5개이다.
- 전체 Day가 아니라 사용자가 선택한 Day만 지도와 경로 계산에 반영한다.

## 5.5 인증 상태 모듈

### 경로

- `frontend/stores/authStore.tsx`
- `frontend/components/requireAuth/RequireAuth.tsx`

### 책임

- 로그인 사용자 상태 전역 관리
- `/api/auth/me` 호출로 인증 상태 확인
- 인증되지 않은 사용자를 `/login`으로 리다이렉트

### 상태

| 필드 | 설명 |
| --- | --- |
| `me` | 현재 로그인 사용자 정보 |
| `isLoggedIn` | 로그인 여부. 초기값은 `null` |
| `fetchMe` | 현재 사용자 조회 |
| `logout` | 로그아웃 처리 |

## 5.6 로컬 여행 계획 저장 모듈

### 파일

- `frontend/lib/travelPlans.ts`

### 책임

- localStorage 기반 여행 계획 저장/조회
- 계획 목록 인덱스 관리
- 계획 ID 생성

### 주요 함수

| 함수 | 설명 |
| --- | --- |
| `createEmptyTravelPlan` | 빈 여행 계획 객체 생성 |
| `loadTravelPlan` | ID 기준 계획 조회 |
| `saveTravelPlan` | 계획 저장 및 인덱스 갱신 |
| `loadTravelPlanIndex` | 마이페이지 계획 목록 조회 |
| `generatePlanId` | UUID 기반 계획 ID 생성 |

### localStorage Key

| Key | 설명 |
| --- | --- |
| `infp.travelPlans.{id}` | 개별 여행 계획 |
| `infp.travelPlans.index` | 계획 목록 인덱스 |

## 6. 데이터베이스 및 인프라 모듈

## 6.1 MySQL

### 역할

- 사용자 정보 저장
- 여행 계획 참여자 정보 저장
- 인증 및 협업 기능의 기준 데이터 저장

### Docker 서비스

- 서비스명: `mysql`
- 이미지: `mysql:8.0`
- 외부 포트: `3308`
- 초기화 SQL: `db/create.sql`

## 6.2 Redis

### 역할

- 인증 토큰 또는 세션성 데이터 저장 용도

### Docker 서비스

- 서비스명: `redis`
- 이미지: `redis:7`

## 6.3 GTFS PostGIS

### 역할

- GTFS 정류장/노선/운행 데이터 적재
- 향후 PostGIS 기반 공간 쿼리 확장 가능

### Docker 서비스

- 서비스명: `gtfs-postgis`
- 이미지: `postgis/postgis:16-3.4`
- 외부 포트: `5433`
- 초기화 SQL:
  - `db/postgis_create.sql`
  - `db/postgis_insert.sql`
- 원본 GTFS 마운트:
  - `db/gtfs/tokyo_rail`

## 6.4 Nominatim

### 역할

- 장소 검색 및 주소 기반 좌표 검색

### Docker 서비스

- 서비스명: `nominatim`
- 이미지: `mediagis/nominatim:4.4`
- 외부 포트: `7070`

## 6.5 Tileserver

### 역할

- Leaflet 지도 타일 제공

### Docker 서비스

- 서비스명: `tileserver`
- 이미지: `maptiler/tileserver-gl:latest`
- 외부 포트: `8082`

## 6.6 Nginx

### 역할

- 프론트엔드, 백엔드, WebSocket, 타일, Nominatim 프록시

### 주요 프록시

| Path | 대상 |
| --- | --- |
| `/` | `frontend:3000` |
| `/api/` | `backend:8080` |
| `/ws/` | `backend:8080` |
| `/tiles/` | `tileserver:8080/styles/basic/` |
| `/api/nominatim/` | `nominatim:8080` |

## 7. 주요 처리 흐름

## 7.1 여행 계획 생성 흐름

1. 사용자가 홈에서 Create 버튼 클릭
2. 기본 템플릿 모달 표시
3. 계획 이름 입력 후 생성
4. 프론트엔드에서 UUID 계획 ID 생성
5. 로그인 사용자를 OWNER 참여자로 추가
6. localStorage에 계획 저장
7. `/createplan/{id}`로 이동

## 7.2 여행 계획 참여 흐름

1. 사용자가 홈에서 Join 버튼 클릭
2. 초대 링크 또는 계획 ID 입력
3. `/createplan/{id}`로 이동
4. 로그인 상태 확인
5. 참여자 이메일 목록이 있으면 현재 사용자 이메일 검증
6. 권한이 있으면 계획 화면 표시, 없으면 접근 제한 화면 표시

## 7.3 실시간 동기화 흐름

1. 계획 화면 진입 시 `/ws/plans/{planId}` WebSocket 연결
2. 입력 중에는 localStorage에만 저장
3. 작성 완료 이벤트 발생 시 `PLAN_UPDATED` 메시지 전송
4. 서버는 같은 planId의 다른 세션에 메시지 브로드캐스트
5. 수신 클라이언트는 title, checklist, participants, days 상태 갱신
6. 서버는 최신 메시지를 메모리에 저장
7. 새로 접속한 클라이언트는 최신 메시지를 즉시 수신

## 7.4 TSP 최적화 흐름

1. 사용자가 Day 선택
2. 선택된 Day에서 좌표가 있는 장소만 추출
3. 장소 수가 2개 이상인지 검증
4. `/api/routes/cost-matrix`로 비용 행렬 조회
5. `/api/routes/optimize` 호출
6. 백엔드에서 모든 순열을 탐색하여 총 이동 시간이 최소인 순서 선택
7. 최적 순서, 구간 정보, 총 거리/시간을 프론트엔드에 표시

## 8. 예외 및 제약 사항

| 항목 | 제약 |
| --- | --- |
| TSP 목적지 수 | 최대 5개 |
| 경로 비용 | 실제 운행 시간표 기반이 아니라 정류장 거리 기반 추정 |
| 실시간 스냅샷 | 현재 서버 메모리 기반이므로 백엔드 재시작 시 최신 WebSocket 스냅샷은 사라짐 |
| 여행 계획 본문 저장 | 현재 프론트엔드 localStorage 중심 |
| 참여자 서버 API | 숫자 planId 기반 DB 설계를 사용하므로 UUID 기반 프론트 계획과 통합 보완 필요 |
| GTFS 원본 데이터 | 용량이 커서 Git 커밋 대상에서 제외 |

## 9. 향후 개선 사항

- UUID 기반 여행 계획을 서버 DB에 영속 저장
- `plans`, `plan_days`, `plan_activities`, `plan_checklists` 테이블 도입
- WebSocket 메시지에 서버 권한 검증 추가
- 참여자 이메일 초대와 서버 계획 저장 모델 통합
- GTFS PostGIS 공간 인덱스를 활용한 `ST_DWithin`, `ST_Distance` 기반 정류장 조회
- 실제 시간표 및 환승 그래프 기반 대중교통 경로 탐색
- 낙관적 락 또는 버전 필드를 통한 동시 편집 충돌 방지
- debounce/commit 정책 세분화
- 지도 경로 시각화 고도화
