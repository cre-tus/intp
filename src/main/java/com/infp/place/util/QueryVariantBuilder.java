package com.infp.place.util;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class QueryVariantBuilder {

    private static final List<String> SUFFIXES = List.of(
            "역", "타워", "랜드", "카페", "공항", "호텔", "공원", "대학교", "터미널", "고등학교"
    );

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
            Map.entry("스카이트리", List.of("東京スカイツリー", "Tokyo Skytree"))
    );

    public static List<String> build(String q) {
        String s = normalize(q);
        if (s.isEmpty()) return List.of();

        Set<String> set = new LinkedHashSet<>();
        addVariant(set, s);
        addVariant(set, s.replace(" ", ""));
        addTranslations(set, s);

        for (String suffix : SUFFIXES) {
            if (s.endsWith(suffix)) {
                String base = s.substring(0, s.length() - suffix.length());
                addVariant(set, base + " " + suffix);
                addSuffixTranslations(set, base, suffix);
            }
        }

        return set.stream().distinct().limit(10).toList();
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
        String key = value.replace(" ", "").toLowerCase(Locale.ROOT);
        TRANSLATIONS.getOrDefault(key, List.of()).forEach(item -> addVariant(set, item));
    }

    private static void addSuffixTranslations(Set<String> set, String base, String suffix) {
        String compactBase = base.replace(" ", "").toLowerCase(Locale.ROOT);
        List<String> baseTranslations = TRANSLATIONS.getOrDefault(compactBase, List.of());
        for (String translatedBase : baseTranslations) {
            switch (suffix) {
                case "역" -> {
                    addVariant(set, translatedBase + "駅");
                    addVariant(set, translatedBase + " Station");
                }
                case "공항" -> {
                    addVariant(set, translatedBase + "空港");
                    addVariant(set, translatedBase + " Airport");
                }
                case "타워" -> {
                    addVariant(set, translatedBase + "タワー");
                    addVariant(set, translatedBase + " Tower");
                }
                case "공원" -> {
                    addVariant(set, translatedBase + "公園");
                    addVariant(set, translatedBase + " Park");
                }
                default -> {
                }
            }
        }
    }
}
