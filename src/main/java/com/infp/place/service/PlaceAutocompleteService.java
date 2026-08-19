package com.infp.place.service;

import com.infp.place.client.NominatimClient;
import com.infp.place.client.PhotonClient;
import com.infp.place.dto.PlaceItem;
import com.infp.place.util.Geo;
import com.infp.place.util.CountryPlaceFilter;
import com.infp.place.util.QueryVariantBuilder;
import com.infp.place.util.KoreanPlaceNameResolver;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.*;

@Service
public class PlaceAutocompleteService {

    private static final Duration RESOLVED_CACHE_TTL = Duration.ofDays(7);
    private static final Duration SELECTED_CACHE_TTL = Duration.ofDays(7);
    private static final String CACHE_VERSION = "v18";
    private static final String SELECTED_CACHE_VERSION = "v1";
    private static final Duration CACHE_TTL = Duration.ofHours(6);
    private static final TypeReference<List<PlaceItem>> PLACE_LIST_TYPE = new TypeReference<>() {};
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final StringRedisTemplate redisTemplate;
    private final PlaceMemoryService placeMemoryService;
    private final PlaceRankingModel rankingModel;
    private final PlaceSearchCacheVersion cacheVersion;
    private final PlaceTranslationService translationService;

    /**
     * Nominatim 외부 호출 전담 클라이언트
     * (HTTP 호출 책임 분리)
     */
    private final NominatimClient nominatimClient;
    private final PhotonClient photonClient;

    public PlaceAutocompleteService(
            NominatimClient nominatimClient,
            PhotonClient photonClient,
            StringRedisTemplate redisTemplate,
            PlaceMemoryService placeMemoryService,
            PlaceRankingModel rankingModel,
            PlaceSearchCacheVersion cacheVersion,
            PlaceTranslationService translationService
    ) {
        this.nominatimClient = nominatimClient;
        this.photonClient = photonClient;
        this.redisTemplate = redisTemplate;
        this.placeMemoryService = placeMemoryService;
        this.rankingModel = rankingModel;
        this.cacheVersion = cacheVersion;
        this.translationService = translationService;
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
        return autocomplete(q, "KR");
    }

    public Mono<List<PlaceItem>> autocomplete(String q, String countryCode) {
        return autocomplete(q, countryCode, null, null);
    }

    public Mono<List<PlaceItem>> searchNominatimOnly(String q, String countryCode) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) return Mono.just(List.of());
        String country = normalizeCountry(countryCode);
        return translationService.expandQueryVariants(query, country)
                .flatMapMany(Flux::fromIterable)
                .flatMap(variant -> nominatimClient.search(variant, country)
                        .flatMapMany(raw -> Flux.fromIterable(mapToPlaceItems(raw, query))))
                .collect(() -> new LinkedHashMap<String, PlaceItem>(),
                        (items, item) -> items.putIfAbsent(item.id(), item))
                .map(items -> items.values().stream()
                        .sorted(Comparator.comparingDouble(PlaceItem::importance).reversed())
                        .limit(20)
                        .toList())
                .flatMap(translationService::localizeResults);
    }

    public Mono<List<PlaceItem>> autocomplete(String q, String countryCode, Double originLat, Double originLon) {

        // 🔹 1) null 방지 + trim 처리
        String s = q == null ? "" : q.trim();

        // 🔹 입력이 비어있으면 바로 빈 리스트 반환
        if (s.isEmpty()) {
            return Mono.just(List.of());
        }

        String country = normalizeCountry(countryCode);
        List<PlaceItem> memoryItems = placeMemoryService.search(s, country, 20).stream()
                .filter(item -> CountryPlaceFilter.isAllowed(item, country))
                .toList();

        boolean locationBiased = originLat != null && originLon != null;
        List<PlaceItem> selectedItems = readSelectedCache(s, country);
        List<PlaceItem> immediateItems = mergeAndRank(s, country, memoryItems, selectedItems, 20, originLat, originLon);
        PlaceItem resolved = locationBiased ? null : readResolvedCache(s, country);
        if (resolved != null) {
            return translationService.localizeResults(mergeAndRank(s, country, immediateItems, List.of(resolved), 20, null, null));
        }

        List<PlaceItem> cached = locationBiased ? null : readCache(s, country);
        if (cached != null) {
            return translationService.localizeResults(mergeAndRank(s, country, immediateItems, cached, 20, null, null));
        }

        // 🔹 2) 후보 생성 (최대 5개)
        // 예: 도쿄타워 → ["도쿄타워", "도쿄 타워"]
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
        return translationService.expandQueryVariants(s, country)
                .flatMapMany(Flux::fromIterable)

                // 후보마다 Nominatim 호출 (비동기 병렬 실행)
                .flatMap(v -> Mono.zip(
                        nominatimClient.search(v, country, originLat, originLon).map(list -> mapToPlaceItems(list, s)),
                        photonClient.search(v, country, s, originLat, originLon)
                ).map(pair -> {
                    List<PlaceItem> combined = new ArrayList<>(pair.getT1());
                    combined.addAll(pair.getT2());
                    return combined;
                }))

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

                    return mergeAndRank(s, country, immediateItems, out, 20, originLat, originLon);
                })
                .flatMap(translationService::localizeResults)
                .doOnNext(result -> {
                    if (!locationBiased) {
                        writeCache(s, country, result);
                        writeResolvedCaches(s, country, result);
                    }
                });
    }

    private List<PlaceItem> mergeAndRank(
            String query,
            String countryCode,
            List<PlaceItem> first,
            List<PlaceItem> second,
            int limit,
            Double originLat,
            Double originLon
    ) {
        LinkedHashMap<String, PlaceItem> merged = new LinkedHashMap<>();
        for (PlaceItem item : first) {
            if (!CountryPlaceFilter.isAllowed(item, countryCode)) continue;
            merged.putIfAbsent(placeMergeKey(item), item);
        }
        for (PlaceItem item : second) {
            if (!CountryPlaceFilter.isAllowed(item, countryCode)) continue;
            merged.putIfAbsent(placeMergeKey(item), item);
        }
        List<PlaceItem> ranked = new ArrayList<>(merged.values());
        Comparator<PlaceItem> rankingComparator = Comparator
                .comparingDouble((PlaceItem item) -> locationAwareScore(query, item, originLat, originLon))
                .reversed()
                .thenComparing(PlaceItem::title, Comparator.nullsLast(String::compareToIgnoreCase));
        ranked.sort(rankingComparator);
        List<PlaceItem> deduplicated = new ArrayList<>();
        for (PlaceItem item : ranked) {
            if (deduplicated.stream().anyMatch(existing -> isNearbyDuplicate(existing, item))) continue;
            deduplicated.add(item);
        }
        return deduplicated.stream().limit(limit).toList();
    }

    private double locationAwareScore(String query, PlaceItem item, Double originLat, Double originLon) {
        double textScore = rankingModel.scoreWithVariants(query, item) + providerQualityBoost(item);
        if (!validCoordinate(originLat, originLon)) return textScore;

        double distanceKm = distanceKm(originLat, originLon, item.lat(), item.lon());
        // Nearby branches of nationwide chains should win without hiding valid inter-city results.
        double proximityBoost = 5.0 / (1.0 + distanceKm / 25.0);
        return textScore + proximityBoost;
    }

    private double providerQualityBoost(PlaceItem item) {
        return switch (searchProvider(item)) {
            case "custom" -> 0.45;
            case "redis" -> 0.30;
            case "nominatim" -> 0.15;
            default -> 0.0;
        };
    }

    private boolean validCoordinate(Double lat, Double lon) {
        return lat != null && lon != null
                && Double.isFinite(lat) && Double.isFinite(lon)
                && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double radiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private boolean isNearbyDuplicate(PlaceItem first, PlaceItem second) {
        if (!searchProvider(first).equals(searchProvider(second))) return false;
        String firstTitle = normalizedKey(first.displayTitle() == null || first.displayTitle().isBlank() ? first.title() : first.displayTitle());
        String secondTitle = normalizedKey(second.displayTitle() == null || second.displayTitle().isBlank() ? second.title() : second.displayTitle());
        if (!firstTitle.equals(secondTitle)) return false;
        return Math.abs(first.lat() - second.lat()) <= 0.01 && Math.abs(first.lon() - second.lon()) <= 0.012;
    }

    private String searchProvider(PlaceItem item) {
        String provider = item.provider() != null ? item.provider() : PlaceItem.inferProvider(item.id());
        return provider.toLowerCase(Locale.ROOT);
    }

    private String placeMergeKey(PlaceItem item) {
        String title = normalizedKey(item.displayTitle() == null || item.displayTitle().isBlank() ? item.title() : item.displayTitle());
        double lat = Math.round(item.lat() * 10_000.0) / 10_000.0;
        double lon = Math.round(item.lon() * 10_000.0) / 10_000.0;
        return title + ":" + lat + ":" + lon;
    }

    private List<PlaceItem> readCache(String query, String countryCode) {
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey(query, countryCode));
            if (cached == null) return null;
            List<PlaceItem> list = objectMapper.readValue(cached, PLACE_LIST_TYPE);
            return list.stream().map(this::asCachedResult).toList();
        } catch (Exception ignored) {
            return null;
        }
    }

    private void writeCache(String query, String countryCode, List<PlaceItem> result) {
        try {
            redisTemplate.opsForValue().set(cacheKey(query, countryCode), objectMapper.writeValueAsString(result), CACHE_TTL);
        } catch (Exception ignored) {
            // Autocomplete should remain available even when Redis is unavailable.
        }
    }

    private String cacheKey(String query, String countryCode) {
        return "place:autocomplete:" + CACHE_VERSION + ":g" + cacheVersion.current() + ":"
                + normalizeCountry(countryCode) + ":" + Integer.toHexString(normalizedKey(query).hashCode());
    }

    private PlaceItem readResolvedCache(String query, String countryCode) {
        try {
            String cached = redisTemplate.opsForValue().get(resolvedCacheKey(query, countryCode));
            if (cached == null) return null;
            PlaceItem item = objectMapper.readValue(cached, PlaceItem.class);
            return asCachedResult(item);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void writeResolvedCaches(String query, String countryCode, List<PlaceItem> result) {
        if (result == null || result.isEmpty()) return;
        writeResolvedCache(query, countryCode, result.get(0));
        for (PlaceItem item : result) {
            writeResolvedCache(item.title(), countryCode, item);
            writeResolvedCache(item.displayTitle(), countryCode, item);
            writeResolvedCache(item.titleKo(), countryCode, item);
            writeResolvedCache(item.titleEn(), countryCode, item);
            writeResolvedCache(item.titleJa(), countryCode, item);
        }
    }

    private void writeResolvedCache(String alias, String countryCode, PlaceItem item) {
        if (alias == null || alias.isBlank() || item == null) return;
        try {
            redisTemplate.opsForValue().set(resolvedCacheKey(alias, countryCode), objectMapper.writeValueAsString(item), RESOLVED_CACHE_TTL);
        } catch (Exception ignored) {
            // Resolved-place cache is only an optimization.
        }
    }

    private String resolvedCacheKey(String query, String countryCode) {
        return "place:resolved:" + CACHE_VERSION + ":g" + cacheVersion.current() + ":"
                + normalizeCountry(countryCode) + ":" + Integer.toHexString(normalizedKey(query).hashCode());
    }

    /**
     * Keeps an explicitly selected itinerary place immediately searchable. This cache is deliberately
     * independent from the autocomplete generation because recording another selection advances that
     * generation. Google-backed items remain cache-only and expire within 30 days.
     */
    public void rememberSelection(PlaceItem item, String query, String countryCode) {
        rememberSelection(item, query, countryCode, Duration.ofDays(7));
    }

    private void rememberSelection(PlaceItem item, String query, String countryCode, Duration ttl) {
        if (item == null) return;
        String country = normalizeCountry(countryCode);
        LinkedHashSet<String> aliases = new LinkedHashSet<>();
        addSelectionAliases(aliases, query);
        addSelectionAliases(aliases, item.sourceQuery());
        addSelectionAliases(aliases, item.title());
        addSelectionAliases(aliases, item.displayTitle());
        addSelectionAliases(aliases, item.titleKo());
        addSelectionAliases(aliases, item.titleEn());
        addSelectionAliases(aliases, item.titleJa());
        aliases.forEach(alias -> writeSelectedCache(alias, country, item, ttl));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmRecentSelectionCache() {
        placeMemoryService.recentSelectionsForCache().forEach(selection ->
                rememberSelection(
                        selection.place(),
                        selection.query(),
                        selection.countryCode(),
                        selection.remainingTtl()
                )
        );
    }

    private void addSelectionAliases(Set<String> aliases, String value) {
        if (value == null || value.isBlank()) return;
        aliases.addAll(QueryVariantBuilder.build(value));
    }

    private List<PlaceItem> readSelectedCache(String query, String countryCode) {
        try {
            String cached = redisTemplate.opsForValue().get(selectedCacheKey(query, countryCode));
            if (cached == null) return List.of();
            List<PlaceItem> list = objectMapper.readValue(cached, PLACE_LIST_TYPE);
            return list.stream().map(this::asCachedResult).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private PlaceItem asCachedResult(PlaceItem item) {
        return "custom".equalsIgnoreCase(item.provider()) || "custom".equals(PlaceItem.inferProvider(item.id()))
                ? item.withProvider("custom")
                : item.withProvider("redis");
    }

    private void writeSelectedCache(String alias, String countryCode, PlaceItem item, Duration ttl) {
        if (alias == null || alias.isBlank()) return;
        try {
            List<PlaceItem> existing = readSelectedCache(alias, countryCode);
            LinkedHashMap<String, PlaceItem> selected = new LinkedHashMap<>();
            selected.put(placeMergeKey(item), item);
            existing.forEach(value -> selected.putIfAbsent(placeMergeKey(value), value));
            List<PlaceItem> retained = selected.values().stream().limit(20).toList();
            redisTemplate.opsForValue().set(
                    selectedCacheKey(alias, countryCode),
                    objectMapper.writeValueAsString(retained),
                    ttl
            );
        } catch (Exception ignored) {
            // Selection recording must still succeed when Redis is unavailable.
        }
    }

    private String selectedCacheKey(String query, String countryCode) {
        return "place:selected:" + SELECTED_CACHE_VERSION + ":"
                + normalizeCountry(countryCode) + ":" + Integer.toHexString(normalizedKey(query).hashCode());
    }

    private String normalizeCountry(String countryCode) {
        if (countryCode == null) return "KR";
        return switch (countryCode.trim().toUpperCase(Locale.ROOT)) {
            case "JP", "JPN", "JA" -> "JP";
            case "KR", "KOR", "KO" -> "KR";
            default -> "KR";
        };
    }

    private String normalizedKey(String query) {
        return query == null
                ? ""
                : query.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
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
            String userQuery
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
                    names.get("name:ja")
            );
            titleKo = KoreanPlaceNameResolver.resolveTitle(titleKo, userQuery, name, titleEn, titleJa, display);
            String title = !name.isBlank() ? name : firstToken(display);
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
                    userQuery,
                    str(r.get("category")),
                    str(r.get("type")),
                    "nominatim"
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
        if (!title.isBlank() && !title.equalsIgnoreCase(main)) {
            originals.add(title);
        }
        if (!titleEn.isBlank() && !titleEn.equalsIgnoreCase(main)
                && originals.stream().noneMatch(titleEn::equalsIgnoreCase)) {
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
