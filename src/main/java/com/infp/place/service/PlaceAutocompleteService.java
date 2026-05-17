package com.infp.place.service;

import com.infp.place.client.NominatimClient;
import com.infp.place.dto.PlaceItem;
import com.infp.place.util.Geo;
import com.infp.place.util.QueryVariantBuilder;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@Service
public class PlaceAutocompleteService {

    // 좌표 정규화 로그 테스트
    private static final Logger log = LoggerFactory.getLogger(PlaceAutocompleteService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Nominatim 외부 호출 전담 클라이언트
     * (HTTP 호출 책임 분리)
     */
    private final NominatimClient nominatimClient;

    public PlaceAutocompleteService(NominatimClient nominatimClient) {
        this.nominatimClient = nominatimClient;
    }

    /**
     * 오토컴플릿 전체 파이프라인
     *
     * 흐름:
     * 1) 입력값 검증
     * 2) 검색 후보(원본/띄어쓰기/붙여쓰기 등) 생성
     * 3) 후보들을 병렬로 Nominatim 호출
     * 4) 결과 merge
     * 5) 중복 제거
     * 6) importance 기준 정렬
     * 7) 상위 N개 반환
     */


    public Mono<List<PlaceItem>> autocomplete(String q) {

        // 🔹 1) null 방지 + trim 처리
        String s = q == null ? "" : q.trim();

        // 🔹 입력이 비어있으면 바로 빈 리스트 반환
        if (s.isEmpty()) {
            return Mono.just(List.of());
        }

        // 🔹 2) 후보 생성 (최대 5개)
        // 예: 도쿄타워 → ["도쿄타워", "도쿄 타워"]
        List<String> variants = QueryVariantBuilder.build(s);

        /**
         * 🔹 3) 병렬 호출 구조
         *
         * Flux.fromIterable(variants)
         *   → 후보들을 하나씩 흘려보냄
         *
         * flatMap(...)
         *   → 각 후보마다 Nominatim HTTP 호출
         *   → Mono<List<Map>> 반환
         *
         * flatMapIterable
         *   → List<PlaceItem> → PlaceItem 개별 요소로 풀기
         */
        return Flux.fromIterable(variants)

                // 후보마다 Nominatim 호출 (비동기 병렬 실행)
                .flatMap(v ->
                        nominatimClient.search(v)
                                // JSON 응답을 우리 DTO로 매핑
                                .map(list -> mapToPlaceItems(list, v))
                )

                // List<PlaceItem> → PlaceItem 단위로 flatten
                .flatMapIterable(x -> x)

                /**
                 * 🔹 4) 중복 제거
                 *
                 * LinkedHashMap 사용 이유:
                 * - key 기반 중복 제거
                 * - 입력 순서 유지
                 *
                 * putIfAbsent → 먼저 들어온 결과를 유지
                 */
                .collect(() -> new LinkedHashMap<String, PlaceItem>(),
                        (map, item) -> map.putIfAbsent(item.id(), item))

                /**
                 * 🔹 5) 정렬 + 개수 제한
                 */
                .map(map -> {
                    List<PlaceItem> out = new ArrayList<>(map.values());

                    // 🔹 importance 기준 정렬
                    out.sort(
                            Comparator.comparingDouble(PlaceItem::importance)
                                    .reversed()
                    );

                    // 🔹 JSON 로그 출력 (여기 추가)
                    try {
                        String json = objectMapper.writeValueAsString(out);
                        log.info("🔥 Nominatim → PlaceItem 변환 결과(JSON): {}", json);
                    } catch (Exception e) {
                        log.error("JSON 변환 실패", e);
                    }

                    // 🔹 상위 15개 제한
                    return out.size() > 15
                            ? out.subList(0, 15)
                            : out;
                });
    }

    /**
     * Nominatim JSON(Map 구조)을
     * 우리가 쓰는 PlaceItem DTO로 변환
     *
     * @param raw Nominatim JSON 리스트
     * @param sourceQuery 어떤 후보로 검색했는지 (디버깅/튜닝용)
     */

    private List<PlaceItem> mapToPlaceItems(
            List<Map<String, Object>> raw,
            String sourceQuery
    ) {

        List<PlaceItem> out = new ArrayList<>();

        for (Map<String, Object> r : raw) {

            // 🔹 place_id는 고유 키 역할
            String placeId = str(r.get("place_id"));
            if (placeId.isBlank()) continue;

            // 🔹 display_name 전체 주소
            String display = str(r.get("display_name"));

            // 🔹 name 필드가 있으면 그걸 제목으로 사용
            // 없으면 display_name의 첫 토큰 사용
            Map<String, Object> names = asMap(r.get("namedetails"));
            String name = str(r.get("name"));
            String titleKo = firstPresent(
                    names.get("name:ko"),
                    names.get("name:ko_rm"),
                    names.get("name:ko-Latn")
            );
            String titleEn = firstPresent(
                    names.get("name:en"),
                    names.get("int_name"),
                    names.get("official_name:en")
            );
            String titleJa = firstPresent(
                    names.get("name:ja"),
                    names.get("name")
            );
            String title = !titleKo.isBlank()
                    ? titleKo
                    : !name.isBlank()
                    ? name
                    : firstToken(display);
            String displayTitle = buildDisplayTitle(title, titleKo, titleEn, titleJa);


            // 🔹 위경도 파싱 + 소수점 4자리 정규화
            // Nominatim은 문자열로 주기 때문에 toDouble로 변환 후 normalize
            double lat = Geo.normalize(toDouble(r.get("lat")));
            double lon = Geo.normalize(toDouble(r.get("lon")));

            // 🔹 importance (Nominatim 랭킹 값)
            double importance = toDouble(
                    r.getOrDefault("importance", 0)
            );

            // 🔹 내부 고유 ID 생성
            String id = "place:" + placeId;

            out.add(new PlaceItem(
                    id,
                    title,
                    displayTitle,
                    titleKo,
                    titleEn,
                    titleJa,
                    display,
                    lat,
                    lon,
                    importance,
                    sourceQuery
            ));
        }

        return out;
    }

    /**
     * display_name에서 첫 번째 콤마 전까지 잘라서
     * 간단한 제목으로 사용
     *
     * 예:
     * "東京タワー, 港区, 東京都, 日本"
     * → "東京タワー"
     */
    private static String firstToken(String display) {
        if (display == null) return "";
        int idx = display.indexOf(',');
        return idx >= 0
                ? display.substring(0, idx).trim()
                : display.trim();
    }

    /**
     * null 안전 문자열 변환
     */
    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object v) {
        return v instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private static String firstPresent(Object... values) {
        for (Object value : values) {
            String s = str(value).trim();
            if (!s.isBlank()) return s;
        }
        return "";
    }

    private static String buildDisplayTitle(String title, String titleKo, String titleEn, String titleJa) {
        String main = !titleKo.isBlank() ? titleKo : title;
        List<String> originals = new ArrayList<>();
        if (!titleEn.isBlank() && !titleEn.equalsIgnoreCase(main)) {
            originals.add(titleEn);
        }
        if (!titleJa.isBlank() && !titleJa.equals(main) && originals.stream().noneMatch(titleJa::equalsIgnoreCase)) {
            originals.add(titleJa);
        }
        return originals.isEmpty()
                ? main
                : main + " (" + String.join(", ", originals) + ")";
    }

    /**
     * 안전한 double 파싱
     */
    private static double toDouble(Object v) {
        if (v == null) return 0;
        try {
            return Double.parseDouble(String.valueOf(v));
        } catch (Exception e) {
            return 0;
        }
    }
}
