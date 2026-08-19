# INTP 여행 플래너 모듈 명세서

작성일: 2026-05-22

## 1. 문서 개요

이 문서는 INTP 여행 플래너 프로젝트의 현재 구현 기준 모듈 구조, 책임, 주요 API, 데이터 의존성을 정리한다. 시스템은 Next.js 프론트엔드, Spring Boot 백엔드, MySQL, Redis, GTFS 데이터, nginx 리버스 프록시, Docker Compose 기반 인프라로 구성된다.

## 2026-08-20 모듈 변경 요약

- 관리자 프런트엔드: `/admin/ml-ingest`, `/admin/place-dataset`, `/admin/recommendation-compare`가 일정 수집·장소 검수·3모델 비교를 담당한다.
- 관리자 백엔드: `AdminMlIngestController`, `AdminPlaceDatasetController`가 비동기 수집 작업, 좌표/내용/특징 검수, Overpass 검색, Nominatim 대체 및 병합 API를 제공한다.
- 장소 모듈: `PhotonClient`, `OverpassClient`, `PlaceTranslationService`, `GooglePlaceRetentionService`가 Nominatim 중심 검색을 보강하고 Google 임시 데이터의 보존·만료를 관리한다.
- 여행 모듈: `MlTrainingPlanSnapshotService`, `TravelPlanPlaceEnrichmentService`, `TravelPlanPlaceMergeService`가 승인 일정 스냅샷과 장소 정합성을 관리한다.
- ML 모듈: `build_dataset.py`, `train.py`, `evaluate.py`, `incremental_quality_gate.py`, `prepare_common_evaluation.py`, `aggregate_cv_metrics.py`가 데이터 생성부터 교집합 평가와 승격까지 담당한다.
- ML 런타임은 cosine baseline, MLP, GNN+MLP를 제공하며 관리자 비교 API는 동일 후보 집합으로 세 결과를 비교한다.
- Docker 서비스는 `mysql`, `redis`, `gtfs-postgis`, `backend`, `frontend`, `ml-ingest`, `ml-recommender`, `nginx`, `certbot`, `tileserver`, `nominatim-jp`를 기본으로 사용하고 한국 Nominatim과 Photon은 profile로 선택 실행한다.

## 2. 아키텍처 스타일

본 프로젝트는 실용적인 Layered Architecture 구조를 따른다.

| 계층 | 주요 책임 | 주요 위치 |
| --- | --- | --- |
| Presentation Layer | 화면 렌더링, 사용자 입력 처리, REST/WebSocket 진입점 제공 | `frontend/app`, `frontend/components`, `*Controller.java` |
| Application/Service Layer | 인증, 여행 계획, 결제, 협업, 장소 검색, 경로 계산 비즈니스 로직 처리 | `*Service.java` |
| Persistence Layer | JPA Repository, Entity, JdbcTemplate 기반 DB 접근 | `*Repository.java`, `*Entity.java`, `JdbcTemplate` 사용 서비스 |
| Infrastructure Layer | 외부 API, Redis, GTFS, nginx, Docker, 인증서, 타일 서버 연동 | `NominatimClient`, `GooglePlaceSearchService`, `docker-compose.yml`, `nginx/default.conf` |

일부 서비스는 `JdbcTemplate`으로 직접 여러 테이블을 조작하므로 엄격한 계층 분리보다는 기능 완성을 우선한 실용적 계층형 구조에 가깝다.

## 3. 기술 스택

### Backend

- Java 17
- Spring Boot
- Spring Web MVC
- Spring WebFlux WebClient
- Spring Security
- Spring WebSocket
- Spring Data JPA
- Spring Data Redis
- MySQL 8.0
- Redis 7
- GTFS 기반 대중교통 데이터
- JWT

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Axios
- DnD Kit
- Lucide React
- Leaflet
- Google Maps JavaScript API

### Infra

- Docker Compose
- nginx reverse proxy
- certbot / Let’s Encrypt
- PostGIS 컨테이너
- Tileserver GL
- Nominatim 컨테이너

## 4. 백엔드 모듈 명세

## 4.1 인증 및 사용자 모듈

### 패키지

- `com.infp.auth`
- `com.infp.user`

### 책임

- 회원가입을 처리한다.
- 이메일 중복 검사를 처리한다.
- 이메일/비밀번호 로그인을 처리한다.
- JWT accessToken과 refreshToken을 발급한다.
- HttpOnly 쿠키 기반 인증 상태를 유지한다.
- 로그아웃 시 refreshToken 무효화와 쿠키 삭제를 수행한다.
- 현재 로그인 사용자 정보를 반환한다.
- 사용자 이메일 기반 조회를 제공한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `AuthController` | 회원가입, 이메일 검사, 로그인, 로그아웃, 내 정보 API 제공 |
| `AuthService` | 비밀번호 검증, 사용자 생성, 토큰 발급, refreshToken 저장/무효화 |
| `JwtTokenProvider` | JWT 생성 및 파싱 |
| `JwtAuthFilter` | 요청 쿠키의 JWT 검증 및 `AuthenticationPrincipal` 설정 |
| `UserController` | 이메일 기반 사용자 조회 API 제공 |
| `UserRepository` | 사용자 JPA 조회 |
| `User` | 사용자 계정 Entity |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 회원가입 |
| `GET` | `/api/auth/check-email` | 이메일 중복 검사 |
| `POST` | `/api/auth/login` | 로그인 및 인증 쿠키 발급 |
| `POST` | `/api/auth/logout` | 로그아웃 및 인증 쿠키 삭제 |
| `GET` | `/api/auth/me` | 현재 로그인 사용자 조회 |
| `GET` | `/api/users/by-email` | 이메일로 활성 사용자 조회 |

## 4.2 여행 계획 모듈

### 패키지

- `com.infp.travel`

### 책임

- 여행 계획표 생성, 조회, 저장, 자동 저장, 삭제를 처리한다.
- 사용자가 소유한 계획표 목록을 조회한다.
- 사용자가 참여자로 등록된 공유 계획표 목록을 조회한다.
- 계획표 접근 권한과 수정 권한을 검증한다.
- 계획표 본문 JSON과 검색/조회용 정규화 데이터를 함께 저장한다.
- 참여자 목록을 `plan_members` 테이블과 동기화한다.
- 테이블형 템플릿 셀 데이터를 `plan_spreadsheet_cells` 테이블과 동기화한다.
- 참여자 수가 0명인 소유 계획표를 자동 정리한다.
- 유료 승인된 소유 계획표 여부를 검증한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `TravelPlanController` | 여행 계획 REST API 제공 |
| `TravelPlanService` | 계획 저장, 권한 검증, 참여자 동기화, 엑셀 셀 동기화, 삭제 처리 |
| `TravelPlanRepository` | 계획 JPA 조회 및 공유 계획 Native Query 제공 |
| `TravelPlanEntity` | `plans` 테이블 Entity |
| `TravelPlanSpreadsheetCellEntity` | `plan_spreadsheet_cells` 테이블 Entity |
| `TravelPlanRequest` | 계획 저장 요청 DTO |
| `TravelPlanResponse` | 계획 상세 응답 DTO |
| `TravelPlanSummaryResponse` | 계획 목록 응답 DTO |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET` | `/api/travel-plans` | 내가 만든 계획 목록 조회 |
| `GET` | `/api/travel-plans/shared` | 참여 가능한 계획 목록 조회 |
| `GET` | `/api/travel-plans/{id}` | 계획 상세 조회 |
| `PUT` | `/api/travel-plans/{id}` | 계획 저장 |
| `POST` | `/api/travel-plans/{id}/autosave` | 페이지 이탈 자동 저장 |
| `DELETE` | `/api/travel-plans/{id}` | 계획 삭제 |

### 저장 모델

| 데이터 | 저장 위치 | 설명 |
| --- | --- | --- |
| 계획 메타데이터 | `plans` | external id, owner, title, template, tier, 날짜, 본문 JSON |
| 전체 계획 본문 | `plans.content_json` | 프론트 상태 전체 스냅샷 |
| 참여자 권한 | `plan_members` | OWNER, EDITOR, VIEWER, ACTIVE 상태 |
| 테이블형 셀 | `plan_spreadsheet_cells` | Day/row/cell 단위 검색 및 통계용 정규화 데이터 |
| 결제 요청 | `payment_requests` | 유료 전환 요청 및 승인 상태 |

## 4.3 협업 참여자 모듈

### 패키지

- `com.infp.plan.collaboration`

### 책임

- 특정 계획표의 참여자 목록을 조회한다.
- 오너 또는 편집자 권한 사용자가 참여자를 추가할 수 있게 한다.
- 참여자 권한을 변경한다.
- 참여자를 삭제한다.
- OWNER 권한 직접 부여 및 OWNER 삭제를 제한한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlanCollaborationController` | 참여자 관리 REST API 제공 |
| `PlanCollaborationService` | 참여자 권한 검증 및 `plan_members` 조작 |
| `PlanParticipantDto` | 참여자 응답 DTO |
| `AddPlanParticipantRequest` | 참여자 추가 요청 DTO |
| `UpdatePlanParticipantRoleRequest` | 참여자 권한 변경 요청 DTO |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET` | `/api/plans/{planId}/participants` | 참여자 목록 조회 |
| `POST` | `/api/plans/{planId}/participants` | 참여자 추가 |
| `PATCH` | `/api/plans/{planId}/participants/{userId}` | 참여자 권한 변경 |
| `DELETE` | `/api/plans/{planId}/participants/{userId}` | 참여자 삭제 |

## 4.4 실시간 협업 모듈

### 패키지

- `com.infp.plan.realtime`

### 책임

- 계획 ID별 WebSocket 세션 그룹을 관리한다.
- 같은 계획표에 접속한 다른 클라이언트에게 수정 메시지를 브로드캐스트한다.
- 계획 ID별 최신 메시지를 서버 메모리에 보관한다.
- 새로 접속한 클라이언트에게 최신 메시지를 전달한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlanRealtimeWebSocketConfig` | `/ws/plans/{planId}` WebSocket endpoint 등록 |
| `PlanRealtimeWebSocketHandler` | 세션 관리, 최신 메시지 저장, 브로드캐스트 |

### WebSocket Endpoint

```text
ws://{host}/ws/plans/{planId}
wss://{host}/ws/plans/{planId}
```

### 메시지 형식

```json
{
  "type": "PLAN_UPDATED",
  "clientId": "client-uuid",
  "editorName": "사용자",
  "editorEmail": "user@example.com",
  "updatedAt": "2026-05-22T00:00:00.000Z",
  "plan": {}
}
```

## 4.5 결제 요청 모듈

### 패키지

- `com.infp.payment`

### 책임

- 유료 버전 전환 결제 요청을 생성한다.
- 동일 계획표의 중복 대기 결제 요청을 방지한다.
- 관리자에게 전체 결제 요청 목록을 제공한다.
- 관리자가 결제 요청을 승인할 수 있게 한다.
- 결제 승인 시 계획표 tier를 `PAID`로 변경한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PaymentRequestController` | 결제 요청 생성, 목록, 승인 API 제공 |
| `PaymentRequestService` | 결제 요청 생성, 중복 검사, 승인 처리, 계획 tier 갱신 |
| `PaymentRequestRepository` | 결제 요청 JPA 조회 |
| `PaymentRequestEntity` | `payment_requests` 테이블 Entity |
| `PaymentStatus` | `PENDING`, `APPROVED` 상태 정의 |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/payments` | 결제 요청 생성 |
| `GET` | `/api/payments` | 관리자 결제 요청 목록 조회 |
| `PATCH` | `/api/payments/{id}/approve` | 관리자 결제 승인 |

## 4.6 장소 검색 모듈

### 패키지

- `com.infp.place`

### 책임

- Nominatim 기반 장소 자동완성 결과를 제공한다.
- 검색어 변형을 생성하여 장소 검색 성공률을 높인다.
- Redis에 장소 자동완성 결과와 resolved-place 결과를 캐싱한다.
- Google 검색 결과와 검색어-장소 관계를 MySQL에 학습 데이터로 저장한다.
- 학습 데이터 변경 시 Redis 검색 세대를 증가시켜 이전 캐시를 무효화한다.
- 유료 승인된 소유 계획표에 한해 Google 장소 검색을 제공한다.
- 유료 승인된 소유 계획표에 한해 Google Maps 브라우저 API 키를 제공한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `PlaceController` | 장소 자동완성, Google 장소 검색, Google Maps 키 API 제공 |
| `PlaceAutocompleteService` | Nominatim 검색, 결과 정렬, Redis 캐시 처리 |
| `GooglePlaceSearchService` | Google Places Text Search API 호출 |
| `PlaceMemoryService` | Google 발견·장소 선택 신호 저장과 로컬 후보 조회 |
| `PlaceRankingModel` | 문자열 일치, 선택 빈도, 최근성 기반 후보 점수 계산 |
| `PlaceSearchCacheVersion` | Redis 검색 학습 generation 조회·증가 |
| `PlaceSchemaInitializer` | 검색 학습 테이블 초기화 |
| `NominatimClient` | Nominatim HTTP 호출 |
| `QueryVariantBuilder` | 검색어 변형 생성 |
| `Geo` | 좌표 정규화 |
| `PlaceItem` | 장소 응답 DTO |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET` | `/api/place/autocomplete?q={keyword}` | Nominatim 장소 자동완성 |
| `GET` | `/api/place/google/search?q={keyword}&planId={planId}` | 유료 계획 Google 장소 검색 |
| `GET` | `/api/place/google/access?planId={planId}` | Google 기능 승인 상태 조회 |
| `GET` | `/api/place/google/maps-key?planId={planId}` | 유료 계획 Google Maps 키 조회 |
| `POST` | `/api/place/selection` | 장소 선택 학습 신호 저장 |

### 검색 학습 모델

| 저장 대상 | 역할 |
| --- | --- |
| `place_memory` | 로컬 검색이 반환할 장소 본문, 다국어명, 좌표, 누적 선택 수 |
| `place_search_learning` | 국가·검색어·장소별 발견 수, 선택 수, 최근 시각 |
| Redis generation | 학습 변경 후 이전 autocomplete/resolved 캐시의 논리적 무효화 |

## 4.7 경로 최적화 모듈

### 패키지

- `com.infp.route`

### 책임

- 좌표가 있는 목적지 목록의 주변 GTFS 정류장을 조회한다.
- 목적지 간 이동 시간 및 거리 비용 행렬을 계산한다.
- 경로 역할 조건을 반영하여 방문 순서를 최적화한다.
- 수동 경로와 최적 경로를 비교한다.
- Redis 캐시 적용 전후 성능 비교 결과를 제공한다.
- 최대 20개 목적지까지 경로 최적화를 처리한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `RouteOptimizationController` | 경로 최적화 REST API 제공 |
| `RouteOptimizationService` | 비용 행렬, nearest-neighbor, 2-opt, Redis 캐시 처리 |
| `GtfsTransitService` | GTFS 정류장 로딩, 주변 정류장 조회, 이동 비용 추정 |
| `RoutePoint` | 목적지 DTO |
| `TransitStop` | 정류장 DTO |
| `RouteLeg` | 구간 이동 정보 DTO |
| `RouteOptimizationResponse` | 최적 경로 응답 DTO |
| `RouteBenchmarkResponse` | Redis 벤치마크 응답 DTO |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/routes/optimize` | 경로 최적화 |
| `POST` | `/api/routes/optimize/benchmark` | Redis 적용 전후 경로 최적화 벤치마크 |
| `POST` | `/api/routes/compare` | 수동 경로와 최적 경로 비교 |
| `POST` | `/api/routes/cost-matrix` | 이동 시간/거리 비용 행렬 조회 |
| `GET` | `/api/routes/stops/nearby` | 주변 정류장 조회 |

### 비용 모델

- 목적지에서 가장 가까운 정류장을 찾는다.
- 출발지에서 출발 정류장까지 도보 시간을 계산한다.
- 정류장 간 직선거리 기반 대중교통 이동 시간을 계산한다.
- 도착 정류장에서 도착지까지 도보 시간을 계산한다.
- 기본 탑승 대기 시간 6분을 더한다.
- 도보 속도는 4.8km/h, 대중교통 평균 속도는 32.0km/h를 사용한다.

## 4.8 관리자 모듈

### 패키지

- `com.infp.admin`

### 책임

- 관리자 서버 테스트를 실행한다.
- 관리자 서버 테스트 작업을 비동기로 시작한다.
- 관리자 서버 테스트 작업 상태를 조회한다.
- 경로 계산용 노드 셔플 테스트를 실행한다.
- Redis 적용/미적용 성능 지표를 관리자에게 제공한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `AdminServerTestController` | 관리자 서버 테스트 API 제공 |
| `AdminServerTestService` | 테스트 데이터 생성, 비동기 작업 관리, 성능 지표 계산 |

### API

| Method | URL | 설명 |
| --- | --- | --- |
| `POST` | `/api/admin/server-test` | 서버 테스트 즉시 실행 |
| `POST` | `/api/admin/server-test/start` | 서버 테스트 비동기 시작 |
| `GET` | `/api/admin/server-test/jobs/{jobId}` | 서버 테스트 작업 상태 조회 |
| `POST` | `/api/admin/server-test/shuffle` | 노드 셔플 테스트 즉시 실행 |
| `POST` | `/api/admin/server-test/shuffle/start` | 노드 셔플 테스트 비동기 시작 |
| `GET` | `/api/admin/server-test/shuffle/jobs/{jobId}` | 노드 셔플 작업 상태 조회 |

## 4.9 글로벌 설정 모듈

### 패키지

- `com.infp.global`

### 책임

- Spring Security 필터 체인을 구성한다.
- CORS 허용 origin, method, credential 정책을 설정한다.
- WebClient Bean을 제공한다.
- 전역 예외를 HTTP 응답으로 변환한다.

### 주요 클래스

| 클래스 | 책임 |
| --- | --- |
| `SecurityConfig` | Security 필터 체인 및 JWT 필터 등록 |
| `SecurityBeans` | 보안 관련 Bean 제공 |
| `WebConfig` | CORS 정책 설정 |
| `WebClientConfig` | WebClient 설정 |
| `GlobalExceptionHandler` | 예외 응답 처리 |

## 5. 프론트엔드 모듈 명세

## 5.1 라우팅 모듈

### 경로

- `frontend/app`

### 페이지

| 파일 | URL | 설명 |
| --- | --- | --- |
| `app/page.tsx` | `/` | 홈 화면 |
| `app/login/page.tsx` | `/login` | 로그인 화면 |
| `app/signup/page.tsx` | `/signup` | 회원가입 화면 |
| `app/createplan/page.tsx` | `/createplan` | 계획 생성 진입 화면 |
| `app/createplan/[createid]/page.tsx` | `/createplan/{createid}` | 계획표 상세 편집 화면 |
| `app/mypage/page.tsx` | `/mypage` | 내 계획 및 참여 계획 목록 |
| `app/community/page.tsx` | `/community` | 피드·Q&A 커뮤니티 |
| `app/community/me/page.tsx` | `/community/me` | 내 커뮤니티 게시물 |
| `app/community/plans/[postId]/page.tsx` | `/community/plans/{postId}` | 공유 계획 상세 |
| `app/admin/payments/page.tsx` | `/admin/payments` | 관리자 결제 승인 화면 |
| `app/admin/server-test/page.tsx` | `/admin/server-test` | 관리자 서버 테스트 화면 |

## 5.2 홈 및 계획 생성 모듈

### 경로

- `frontend/components/home`

### 책임

- 홈 화면의 주요 콘텐츠와 추천 여행지 UI를 제공한다.
- 계획 생성 모달을 제공한다.
- 기본형/테이블형 템플릿 선택을 제공한다.
- 무료/유료 버전 선택을 제공한다.
- 유료 결제 요청 입력 폼을 제공한다.
- 초대 링크 또는 계획 ID로 계획 참여를 검증하고 이동한다.

### 주요 컴포넌트

| 컴포넌트 | 책임 |
| --- | --- |
| `PrimaryButton` | 템플릿/요금제 선택, 계획 생성, 결제 요청 생성 |
| `SecondaryButton` | 초대 링크 또는 계획 ID 참여 |
| `HeroSection` | 홈 메인 콘텐츠 |
| `MovingRow` | 추천 여행지 이미지 영역 |
| `Frame` | 추천 여행지 섹션 제목 |

## 5.3 계획표 편집 모듈

### 경로

- `frontend/components/planner`

### 책임

- 여행 계획표 편집 화면의 전체 상태를 관리한다.
- 계획 로딩, 저장, 자동 저장, WebSocket 동기화를 처리한다.
- 체크리스트, 기본형 일정표, 테이블형 일정표, 참여자, 경로 계산 패널을 통합한다.
- 무료/유료 tier에 따라 장소 검색과 경로 노드 제한을 적용한다.

### 주요 컴포넌트

| 컴포넌트 | 책임 |
| --- | --- |
| `HeroSection` | 계획 편집 상태, 저장, 자동 저장, 실시간 동기화 관리 |
| `TravelCheckList` | 여행 전 준비물과 경비 관리 |
| `TravelItinerary` | 기본형/테이블형 일정표 UI 제공 |
| `DayCard` | 기본형 Day 단위 편집 |
| `ActivityRow` | 기본형 일정 항목 편집 |
| `SortableDayCard` | Day 드래그 정렬 |
| `SortableActivityRow` | 일정 항목 드래그 정렬 |
| `PlaceSerachModal` | 장소 검색 모달 |
| `PlaceSerachInput` | Nominatim/Google 장소 검색 입력 |
| `MapRoutePanel` | 지도, 주변 정류장, 경로 최적화, 경로 비교 |
| `ParticipantsSidebar` | 참여자 목록, 추가, 삭제, 권한 변경, 초대 링크 복사 |
| `SaveSection` | 수동 저장 및 마지막 저장 정보 표시 |

테이블형은 열 너비·행 높이 조절, 00:00~24:00 직접 입력, 장소 연결 셀 강조, 열 단위 장소검색 안내 제거, 전용 비용 계산을 제공한다.

## 5.4 커뮤니티 모듈

### 경로

- `frontend/app/community`
- `frontend/lib/community.ts`
- `com.infp.community`

### 책임

- 계획·사진 피드와 Q&A를 게시물 유형으로 분리한다.
- Q&A 전용 작성 폼, 카드, 답변, 저장 동작을 제공한다.
- 이미지와 5분 미만 동영상을 로컬 저장소에 업로드한다.
- 게시물 반응, 저장, 댓글/답변, 공유 계획 복사를 처리한다.
- 답변 좋아요를 영속 저장하고 Q&A 답변을 추천순으로 정렬한다.

### 주요 백엔드 클래스

| 클래스 | 책임 |
| --- | --- |
| `CommunityController` | 게시물·미디어·반응·답변 REST API |
| `CommunityService` | 게시물 유형 정규화, 권한, 미디어 메타데이터 동기화 |
| `CommunityMediaStorageService` | MIME·크기·영상 길이 검사와 로컬 파일 저장 |
| `CommunityPostMediaEntity` | 로컬/CDN URL과 파일 메타데이터 저장 |

### 주요 API

| Method | URL | 설명 |
| --- | --- | --- |
| `GET/POST` | `/api/community/posts` | 게시물 목록·작성 |
| `PUT/DELETE` | `/api/community/posts/{postId}` | 게시물 수정·삭제 |
| `POST` | `/api/community/posts/media` | Q&A 이미지·동영상 업로드 |
| `POST` | `/api/community/posts/{postId}/save` | 피드 저장 또는 Q&A `나도 알고싶어요` |
| `GET/POST` | `/api/community/posts/{postId}/comments` | 댓글·Q&A 답변 조회/작성 |
| `POST` | `/api/community/posts/{postId}/comments/{commentId}/like` | 답변 좋아요 토글 |

### 주요 상태 모델

```ts
type TravelPlanDraft = {
  id: string;
  title: string;
  template: "basic" | "spreadsheet";
  tier: "FREE" | "PENDING_PAID" | "PAID";
  checklist: ChecklistItem[];
  days: ItineraryDay[];
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
};
```

```ts
type ItineraryDay = {
  id: string;
  date: string;
  dayTitle: string;
  activities: ItineraryActivity[];
};
```

```ts
type ItineraryActivity = {
  id: string;
  time: string;
  location: string;
  activity: string;
  cost: number;
  routeRole?: "NONE" | "LODGING" | "START" | "END" | "FIXED";
  placeId?: string;
  placeSubtitle?: string;
  lat?: number;
  lon?: number;
};
```

## 5.5 마이페이지 모듈

### 경로

- `frontend/app/mypage/page.tsx`

### 책임

- 로그인 사용자 계정 정보를 표시한다.
- 내가 만든 계획표 목록을 표시한다.
- 참여 가능한 공유 계획표 목록을 표시한다.
- 계획표별 템플릿 유형, 요금 상태, 참여자 수를 표시한다.
- 내가 만든 계획표 삭제 기능을 제공한다.

## 5.6 인증 상태 모듈

### 경로

- `frontend/stores/authStore.tsx`
- `frontend/components/requireAuth/RequireAuth.tsx`

### 책임

- `/api/auth/me` 호출로 로그인 상태를 확인한다.
- 로그인 사용자 정보를 전역 상태로 관리한다.
- 보호 페이지 접근 시 비로그인 사용자를 로그인 페이지로 이동시킨다.
- 로그아웃 요청 후 클라이언트 인증 상태를 초기화한다.

## 5.7 API 클라이언트 모듈

### 경로

- `frontend/service/api.ts`
- `frontend/lib/travelPlans.ts`
- `frontend/lib/payments.ts`
- `frontend/lib/googleMaps.ts`

### 책임

- Axios 기반 API 클라이언트를 제공한다.
- 계획표 CRUD API 호출을 래핑한다.
- 결제 요청 API 호출을 래핑한다.
- Google Maps 스크립트 로딩과 API 키 조회를 처리한다.

## 5.8 테마 모듈

### 경로

- `frontend/components/theme/ThemeToggle.tsx`

### 책임

- 라이트/다크 모드 토글 버튼을 제공한다.
- 선택한 테마 모드를 `localStorage`에 저장한다.
- `document.documentElement`에 `dark` 클래스를 적용하거나 제거한다.

## 6. 데이터베이스 및 인프라 모듈

## 6.1 MySQL

### 책임

- 사용자 계정, 인증 토큰 해시, 여행 계획, 참여자, 테이블형 셀, 결제 요청 데이터를 영속 저장한다.

### 주요 테이블

| 테이블 | 설명 |
| --- | --- |
| `users` | 사용자 계정, 권한, 상태, refreshToken hash |
| `plans` | 여행 계획 메타데이터와 전체 JSON 스냅샷 |
| `plan_members` | 계획 참여자와 권한 |
| `plan_days` | 기본형 일정 Day 정규화 테이블 |
| `plan_items` | 기본형 일정 항목 정규화 테이블 |
| `plan_spreadsheet_cells` | 테이블형 셀 정규화 테이블 |
| `plan_checklist_items` | 체크리스트 정규화 테이블 |
| `payment_requests` | 유료 결제 요청 |
| `places` | 장소 마스터 데이터 |

## 6.2 Redis

### 책임

- 장소 자동완성 결과 캐시를 저장한다.
- 장소 resolved alias 캐시를 저장한다.
- 경로 최적화 전체 결과 캐시를 저장한다.
- 주변 정류장 및 구간 비용 추정 캐시를 저장한다.
- 서버 테스트와 경로 계산 벤치마크의 캐시 적용 효과 확인에 사용된다.

## 6.3 GTFS 데이터

### 책임

- `db/gtfs/tokyo_rail` 데이터셋을 기반으로 정류장 정보를 로딩한다.
- 주변 정류장 조회와 대중교통 이동 비용 추정에 사용된다.

## 6.4 nginx

### 책임

- 외부 HTTP/HTTPS 요청을 프론트엔드와 백엔드로 프록시한다.
- HTTP 요청을 HTTPS로 리다이렉트한다.
- `/api/`, `/ws/`, `/tiles/`, `/api/nominatim/` 경로를 내부 서비스로 전달한다.
- 외부 사용자가 내부 서비스 포트를 직접 알 필요 없게 한다.

## 6.5 Docker Compose

### 서비스

| 서비스 | 역할 |
| --- | --- |
| `mysql` | MySQL 데이터 저장소 |
| `redis` | Redis 캐시 |
| `gtfs-postgis` | PostGIS 기반 GTFS 보조 저장소 |
| `backend` | Spring Boot API 서버 |
| `frontend` | Next.js 프론트엔드 서버 |
| `nginx` | HTTPS reverse proxy |
| `certbot` | Let’s Encrypt 인증서 발급 및 갱신 |
| `tileserver` | 지도 타일 서버 |
| `nominatim` | 장소 검색 서버 |

## 7. 주요 처리 흐름

## 7.1 회원가입 및 로그인 흐름

1. 사용자가 회원가입 정보를 입력한다.
2. 프론트엔드가 `/api/auth/register`로 요청한다.
3. 백엔드는 이메일 중복, 비밀번호 해시, 사용자 상태를 처리한다.
4. 사용자가 로그인 정보를 입력한다.
5. 백엔드는 비밀번호를 검증하고 accessToken/refreshToken을 생성한다.
6. 백엔드는 refreshToken hash를 `users`에 저장한다.
7. 백엔드는 accessToken/refreshToken을 HttpOnly 쿠키로 내려준다.
8. 이후 요청은 `JwtAuthFilter`가 쿠키를 검증하여 사용자 principal을 주입한다.

## 7.2 계획표 생성 흐름

1. 사용자가 Create 버튼을 누른다.
2. 사용자가 제목, 템플릿, 요금제를 선택한다.
3. 프론트엔드가 `plan-{uuid}` 형태의 external id를 생성한다.
4. 프론트엔드가 기본형 또는 테이블형 초기 `TravelPlanDraft`를 생성한다.
5. 로그인 사용자 정보를 OWNER 참여자로 포함한다.
6. 프론트엔드가 `/api/travel-plans/{id}`로 저장 요청을 보낸다.
7. 백엔드는 `plans`에 메타데이터와 JSON 스냅샷을 저장한다.
8. 백엔드는 `plan_members`에 OWNER를 보장한다.
9. 백엔드는 템플릿에 따라 정규화 데이터를 동기화한다.
10. 프론트엔드는 `/createplan/{id}`로 이동한다.

## 7.3 계획표 저장 및 실시간 협업 흐름

1. 사용자가 계획표를 수정한다.
2. 프론트엔드가 현재 상태를 `TravelPlanDraft`로 구성한다.
3. 저장 트리거 발생 시 `/api/travel-plans/{id}`로 전체 스냅샷을 저장한다.
4. 페이지 이탈 시 `navigator.sendBeacon` 또는 `fetch keepalive`로 `/autosave`를 호출한다.
5. 저장 성공 후 WebSocket이 연결되어 있으면 `PLAN_UPDATED` 메시지를 전송한다.
6. 서버는 같은 planId의 다른 세션에 메시지를 브로드캐스트한다.
7. 다른 클라이언트는 메시지를 받아 화면 상태를 갱신하고 DB 저장을 수행한다.

## 7.4 결제 승인 흐름

1. 사용자가 유료 버전 계획 생성 과정에서 입금 정보를 입력한다.
2. 프론트엔드가 계획을 `PENDING_PAID` 상태로 저장한다.
3. 프론트엔드가 `/api/payments`로 결제 요청을 생성한다.
4. 백엔드는 중복 PENDING 요청을 검사한다.
5. 백엔드는 `payment_requests`에 결제 요청을 저장한다.
6. 관리자가 `/admin/payments`에서 결제 요청을 확인한다.
7. 관리자가 승인 버튼을 누르면 `/api/payments/{id}/approve`가 호출된다.
8. 백엔드는 결제 요청 상태를 `APPROVED`로 변경한다.
9. 백엔드는 해당 계획표의 tier를 `PAID`로 변경한다.

## 7.5 경로 최적화 흐름

1. 사용자가 좌표가 있는 일정 장소를 입력한다.
2. 사용자가 경로 계산 패널에서 Day를 선택한다.
3. 프론트엔드는 선택한 Day의 좌표 보유 일정만 추출한다.
4. 프론트엔드는 `/api/routes/optimize/benchmark` 또는 `/api/routes/optimize`를 호출한다.
5. 백엔드는 목적지 좌표를 검증한다.
6. 백엔드는 GTFS 정류장 데이터를 사용해 nearest stop과 구간 비용을 계산한다.
7. 백엔드는 경로 역할 조건을 반영해 nearest-neighbor와 2-opt 기반 최적 순서를 계산한다.
8. 백엔드는 최적 순서, 구간 정보, 비용 행렬, 정류장 정보, 계산 시간을 반환한다.
9. 프론트엔드는 결과를 지도와 목록에 표시하고 사용자가 일정 순서에 반영할 수 있게 한다.

## 8. 제약 및 주의사항

- WebSocket 최신 메시지 캐시는 서버 메모리 기반이므로 백엔드 재시작 시 사라진다.
- Redis 캐시는 성능 최적화 계층이므로 장애 시에도 직접 계산으로 폴백한다.
- Google 장소 검색과 Google Maps 키 조회는 `PAID` 상태의 소유자 계획표에서만 허용된다.
- 무료 계획표는 프론트엔드에서 경로 노드를 최대 10개로 제한한다.
- 유료 계획표는 프론트엔드에서 경로 노드를 최대 20개로 제한한다.
- 백엔드 경로 최적화는 최대 20개 목적지를 허용한다.
- 계획표 본문은 `plans.content_json`이 원본 스냅샷 역할을 하며 일부 테이블은 검색/통계/조회 보조용 정규화 데이터로 사용된다.
