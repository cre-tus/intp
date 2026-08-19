# INTP 여행 플래너

여행 일정 작성, 장소 검색, 경로 최적화, 공동 편집, 커뮤니티 공유를 제공하는 웹 애플리케이션입니다.

## 구성

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Backend: Java 17, Spring Boot 4, JPA, WebFlux, WebSocket
- Data: MySQL 8, Redis 7, PostgreSQL/PostGIS, GTFS
- Place search: Nominatim Korea/Japan, Photon Japan, 로컬 검색 메모리
- ML: PyTorch 여행지 추천과 일정 생성 파이프라인
- Infra: Docker Compose, nginx, certbot

## 디렉터리

```text
frontend/                 Next.js 애플리케이션
src/main/java/com/infp/   Spring Boot 백엔드
src/test/java/com/infp/   백엔드 테스트
db/                       DB 초기 스키마
docker/photon/            Photon 이미지와 시작 스크립트
ml/recommender/           추천 모델 학습과 추론
scripts/                  데이터 및 운영 스크립트
docs/                     설계와 구현 문서
```

## Docker 실행

```powershell
docker compose up -d --build
docker compose ps
```

관리자 여행 데이터 수집 화면은 `http://localhost/admin/ml-ingest`에서 열 수 있습니다. 이미지 최대 10장을 한 여행의 연속 페이지로 합치거나 사진별 별도 일정으로 순차 처리할 수 있습니다. 추출 결과는 기본 템플릿의 시간·장소·내용 행으로 검수하며, 승인하면 학습 시드와 관리자 소유 여행 계획에 함께 반영됩니다.

WSL 메모리는 `C:\Users\pinea\.wslconfig`에서 10GB로 제한합니다. 도쿄 개발 모드에서는 일본 Nominatim을 기본으로 사용하고 한국 Nominatim과 Photon은 필요할 때 profile로 실행합니다.

## Photon 일본 검색

Photon 일본 인덱스는 최초 실행 때 `data/photon`에 다운로드됩니다. 현재 Compose 제한은 Photon 컨테이너 1GB, Java 힙 512MB입니다. 기본 일본 검색은 `nominatim-jp`이며 Photon은 `photon` profile이 활성화된 경우에만 사용합니다.

핵심 설계와 운영 문서는 [핵심 명세서 안내](docs/essential-specs.md)에서 확인합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-photon.ps1
docker compose --profile photon logs -f photon
curl.exe http://127.0.0.1:2322/status
```

Photon을 사용하지 않을 때:

```powershell
docker compose --profile photon stop photon
docker compose --profile korea up -d nominatim
```

장소 번역은 로컬 LibreTranslate와 Argos Translate의 한국어·영어·일본어 모델을 사용합니다. 한국어 검색어는 영어와 일본어 후보로 확장되고 외국어 결과 제목은 한국어로 변환됩니다. 번역은 Redis에 30일 캐시되며 로컬 번역기가 준비되지 않았을 때는 OSM 다국어 이름과 정적 별칭 검색으로 자동 전환됩니다.

## 개발 실행

```powershell
./gradlew.bat bootRun

cd frontend
npm install
npm run dev
```

## 검증

```powershell
./gradlew.bat test
docker compose config --quiet

cd frontend
npm run lint
npm run build
```

추천 모델과 이미지 일정 변환은 [ml/recommender/README.md](ml/recommender/README.md), 프론트엔드 명령은 [frontend/README.md](frontend/README.md)를 참고합니다.
