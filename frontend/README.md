# INTP Frontend

Next.js 16과 React 19로 만든 여행 플래너 UI입니다.

## 실행

```powershell
cd frontend
npm install
npm run dev
```

Docker 개발 서버는 저장소 루트에서 실행합니다.

```powershell
docker compose up -d frontend nginx
docker compose logs -f frontend
```

## 주요 화면

- 여행 계획 편집과 장소 검색
- 일정별 비용, 시간, 이동 경로 관리
- WebSocket 기반 공동 편집
- 커뮤니티 피드와 게시물 상세
- 마이페이지의 게시물, 좋아요, 저장 목록

## 검증

```powershell
cd frontend
npm run lint
npm run build
```

## 관리자 여행 데이터 수집

관리자 메뉴의 `여행 데이터 수집` 또는 `http://localhost/admin/ml-ingest`에서 여행 계획 이미지 최대 10장을 업로드할 수 있습니다. 여러 장을 한 일정으로 합치거나 사진별 별도 일정으로 처리할 수 있으며, 별도 일정 결과는 작업 탭으로 전환합니다. 화면은 기본 템플릿의 시간·장소·내용 행과 Qwen OCR·구조화·재검증 메시지를 표시합니다.

로컬 개발 주소는 `http://localhost:3000`, nginx 경유 주소는 `https://tuk-intp.kro.kr`입니다.
