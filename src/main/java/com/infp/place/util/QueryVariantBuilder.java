package com.infp.place.util;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class QueryVariantBuilder {

    private static final List<String> STATION_SUFFIXES = List.of("역", "駅");
    private static final List<String> AIRPORT_SUFFIXES = List.of("공항", "空港");
    private static final List<String> TOWER_SUFFIXES = List.of("타워", "タワー");
    private static final List<String> PARK_SUFFIXES = List.of("공원", "公園");

    private static final Map<String, List<String>> TRANSLATIONS = Map.ofEntries(
            Map.entry("도쿄", List.of("東京", "Tokyo")),
            Map.entry("동경", List.of("東京", "Tokyo")),
            Map.entry("도쿄역", List.of("東京駅", "Tokyo Station")),
            Map.entry("신주쿠", List.of("新宿", "Shinjuku")),
            Map.entry("신주쿠역", List.of("新宿駅", "Shinjuku Station")),
            Map.entry("시부야", List.of("渋谷", "Shibuya")),
            Map.entry("시부야역", List.of("渋谷駅", "Shibuya Station")),
            Map.entry("우에노", List.of("上野", "Ueno")),
            Map.entry("우에노역", List.of("上野駅", "Ueno Station")),
            Map.entry("아키하바라", List.of("秋葉原", "Akihabara")),
            Map.entry("아키하바라역", List.of("秋葉原駅", "Akihabara Station")),
            Map.entry("이케부쿠로", List.of("池袋", "Ikebukuro")),
            Map.entry("이케부쿠로역", List.of("池袋駅", "Ikebukuro Station")),
            Map.entry("오사카", List.of("大阪", "Osaka")),
            Map.entry("오사카역", List.of("大阪駅", "Osaka Station")),
            Map.entry("교토", List.of("京都", "Kyoto")),
            Map.entry("교토역", List.of("京都駅", "Kyoto Station")),
            Map.entry("삿포로", List.of("札幌", "Sapporo")),
            Map.entry("삿포로역", List.of("札幌駅", "Sapporo Station")),
            Map.entry("후쿠오카", List.of("福岡", "Fukuoka")),
            Map.entry("나고야", List.of("名古屋", "Nagoya")),
            Map.entry("하네다공항", List.of("羽田空港", "Haneda Airport")),
            Map.entry("나리타공항", List.of("成田空港", "Narita Airport")),
            Map.entry("도쿄타워", List.of("東京タワー", "Tokyo Tower")),
            Map.entry("도쿄스카이트리", List.of("東京スカイツリー", "Tokyo Skytree")),
            Map.entry("서울역", List.of("Seoul Station")),
            Map.entry("부산역", List.of("Busan Station")),
            Map.entry("제주공항", List.of("Jeju International Airport")),
            Map.entry("김포공항", List.of("Gimpo International Airport")),
            Map.entry("인천공항", List.of("Incheon International Airport")),
            Map.entry("경복궁", List.of("Gyeongbokgung Palace")),
            Map.entry("해운대", List.of("Haeundae")),
            Map.entry("성산일출봉", List.of("Seongsan Ilchulbong"))
    );

    public static List<String> build(String q) {
        String s = normalize(q);
        if (s.isEmpty()) return List.of();

        Set<String> set = new LinkedHashSet<>();
        addVariant(set, s);
        addVariant(set, s.replace(" ", ""));
        addTranslations(set, s);
        addSuffixVariants(set, s);

        return set.stream().distinct().limit(12).toList();
    }

    private static String normalize(String q) {
        if (q == null) return "";
        return Normalizer.normalize(q, Normalizer.Form.NFKC)
                .trim()
                .replaceAll("\\s+", " ");
    }

    private static void addVariant(Set<String> set, String value) {
        String normalized = normalize(value);
        if (!normalized.isBlank()) set.add(normalized);
    }

    private static void addTranslations(Set<String> set, String value) {
        String key = compactKey(value);
        TRANSLATIONS.getOrDefault(key, List.of()).forEach(item -> addVariant(set, item));
    }

    private static void addSuffixVariants(Set<String> set, String value) {
        addSuffixTranslations(set, value, STATION_SUFFIXES, List.of("駅", " Station"));
        addSuffixTranslations(set, value, AIRPORT_SUFFIXES, List.of("空港", " Airport"));
        addSuffixTranslations(set, value, TOWER_SUFFIXES, List.of("タワー", " Tower"));
        addSuffixTranslations(set, value, PARK_SUFFIXES, List.of("公園", " Park"));
    }

    private static void addSuffixTranslations(Set<String> set, String value, List<String> sourceSuffixes, List<String> translatedSuffixes) {
        for (String suffix : sourceSuffixes) {
            if (!value.endsWith(suffix)) continue;
            String base = value.substring(0, value.length() - suffix.length()).trim();
            addVariant(set, base + " " + suffix);
            for (String translatedBase : TRANSLATIONS.getOrDefault(compactKey(base), List.of())) {
                boolean ascii = translatedBase.chars().allMatch(ch -> ch < 128);
                for (String translatedSuffix : translatedSuffixes) {
                    boolean englishSuffix = translatedSuffix.chars().allMatch(ch -> ch < 128);
                    if (ascii == englishSuffix) addVariant(set, translatedBase + translatedSuffix);
                }
            }
        }
    }

    private static String compactKey(String value) {
        return normalize(value).replace(" ", "").toLowerCase(Locale.ROOT);
    }
}
