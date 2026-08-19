package com.infp.place.util;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class KoreanPlaceNameResolver {
    private static final Set<String> GENERIC_OR_LOCATION_TOKENS = Set.of(
            "호텔", "역", "공항", "공원", "카페", "맛집", "식당", "관광지", "도쿄", "동경", "신주쿠",
            "시부야", "우에노", "아키하바라", "이케부쿠로", "오사카", "교토", "삿포로", "후쿠오카", "나고야"
    );
    private static final Map<String, String> CANONICAL_TITLES = Map.ofEntries(
            Map.entry("다이이치호텔", "다이이치 호텔 도쿄"),
            Map.entry("다이이치호텔도쿄", "다이이치 호텔 도쿄"),
            Map.entry("크라운힐스호텔우에노", "호텔 크라운 힐스 우에노 프리미어"),
            Map.entry("호텔크라운힐스우에노", "호텔 크라운 힐스 우에노 프리미어"),
            Map.entry("크라운힐스우에노프리미어", "호텔 크라운 힐스 우에노 프리미어")
    );
    private static final Map<String, String> ADDRESS_REPLACEMENTS = addressReplacements();

    private KoreanPlaceNameResolver() {
    }

    public static String resolveTitle(
            String existingKorean,
            String userQuery,
            String title,
            String titleEnglish,
            String titleJapanese,
            String subtitle
    ) {
        if (containsHangul(existingKorean) && !isGenericLanguageLabel(existingKorean)) return clean(existingKorean);
        String query = clean(userQuery);
        if (!containsHangul(query) || !isSpecificPlaceQuery(query)) return "";

        Set<String> resultNames = java.util.stream.Stream.of(title, titleEnglish, titleJapanese)
                .map(KoreanPlaceNameResolver::normalizeForMatch)
                .filter((value) -> !value.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        boolean translatedAliasMatches = QueryVariantBuilder.build(query).stream()
                .filter((variant) -> !containsHangul(variant))
                .map(KoreanPlaceNameResolver::normalizeForMatch)
                .filter((variant) -> variant.length() >= 4)
                .anyMatch(resultNames::contains);
        if (!translatedAliasMatches) return "";

        String compactQuery = compact(query);
        String canonical = CANONICAL_TITLES.getOrDefault(compactQuery, query);
        if (!containsTokyo(canonical) && resultNames.stream().anyMatch(KoreanPlaceNameResolver::containsTokyo)) canonical += " 도쿄";
        return canonical;
    }

    public static String localizeSubtitle(String subtitle) {
        String localized = clean(subtitle);
        if (localized.isBlank()) return localized;
        for (Map.Entry<String, String> entry : ADDRESS_REPLACEMENTS.entrySet()) {
            localized = localized.replace(entry.getKey(), entry.getValue());
        }
        return localized;
    }

    private static boolean isSpecificPlaceQuery(String query) {
        List<String> tokens = List.of(query.split(" "));
        if (tokens.size() == 1 && CANONICAL_TITLES.containsKey(compact(query))) return true;
        return tokens.stream()
                .map(KoreanPlaceNameResolver::compact)
                .anyMatch((token) -> token.length() >= 2 && !GENERIC_OR_LOCATION_TOKENS.contains(token));
    }

    private static boolean containsTokyo(String value) {
        String normalized = normalizeForMatch(value);
        return normalized.contains("도쿄") || normalized.contains("tokyo") || normalized.contains("東京");
    }

    private static boolean containsHangul(String value) {
        if (value == null) return false;
        return value.codePoints().anyMatch((codePoint) -> codePoint >= 0xAC00 && codePoint <= 0xD7A3);
    }

    private static boolean isGenericLanguageLabel(String value) {
        String normalized = normalizeForMatch(value);
        return Set.of("한국어", "일본어", "영어", "korean", "japanese", "english").contains(normalized);
    }

    private static String normalizeForMatch(String value) {
        return Normalizer.normalize(nullToBlank(value), Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private static String compact(String value) {
        return clean(value).replace(" ", "").toLowerCase(Locale.ROOT);
    }

    private static String clean(String value) {
        return value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFKC).trim().replaceAll("\\s+", " ");
    }

    private static String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private static Map<String, String> addressReplacements() {
        Map<String, String> replacements = new LinkedHashMap<>();
        replacements.put("第一ホテル東京", "다이이치 호텔 도쿄");
        replacements.put("Dai-ichi Hotel Tokyo", "다이이치 호텔 도쿄");
        replacements.put("Daiichi Hotel Tokyo", "다이이치 호텔 도쿄");
        replacements.put("Sotobori-dori", "소토보리도리");
        replacements.put("東京都", "도쿄도");
        replacements.put("港区", "미나토구");
        replacements.put("新宿区", "신주쿠구");
        replacements.put("渋谷区", "시부야구");
        replacements.put("千代田区", "지요다구");
        replacements.put("中央区", "주오구");
        replacements.put("台東区", "다이토구");
        replacements.put("豊島区", "도시마구");
        replacements.put("新橋", "신바시");
        replacements.put("日本", "일본");
        return replacements;
    }
}
