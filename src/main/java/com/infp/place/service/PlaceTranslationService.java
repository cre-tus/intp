package com.infp.place.service;

import com.infp.place.dto.PlaceItem;
import com.infp.place.util.PlaceTextSimilarity;
import com.infp.place.util.QueryVariantBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class PlaceTranslationService {
    private static final Logger log = LoggerFactory.getLogger(PlaceTranslationService.class);
    private static final Duration CACHE_TTL = Duration.ofDays(30);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(8);
    private static final long ERROR_COOLDOWN_MILLIS = Duration.ofMinutes(1).toMillis();
    private static final int MAX_RESULT_TITLES = 20;

    private final WebClient webClient;
    private final StringRedisTemplate redisTemplate;
    private final boolean enabled;
    private final AtomicLong disabledUntil = new AtomicLong(0);

    public PlaceTranslationService(
            WebClient.Builder builder,
            StringRedisTemplate redisTemplate,
            @Value("${place.translation.base-url:http://libretranslate:5000}") String baseUrl,
            @Value("${place.translation.enabled:true}") boolean enabled
    ) {
        this.webClient = builder.clone().baseUrl(baseUrl).build();
        this.redisTemplate = redisTemplate;
        this.enabled = enabled;
    }

    public Mono<List<String>> expandQueryVariants(String query, String countryCode) {
        List<String> localVariants = QueryVariantBuilder.build(query);
        if (!canTranslate() || !"JP".equalsIgnoreCase(countryCode) || !containsHangul(query)) {
            return Mono.just(localVariants);
        }

        return Mono.zip(translateOne(query, "ja"), translateOne(query, "en"))
                .flatMap(translated -> Mono.zip(
                        validateSearchTranslation(query, translated.getT1()),
                        validateSearchTranslation(query, translated.getT2())
                ))
                .map(validated -> {
                    Set<String> variants = new LinkedHashSet<>(localVariants);
                    addIfUseful(variants, validated.getT1());
                    addIfUseful(variants, validated.getT2());
                    return variants.stream().limit(14).toList();
                })
                .onErrorReturn(localVariants);
    }

    private Mono<String> validateSearchTranslation(String originalQuery, String translatedQuery) {
        if (translatedQuery == null || translatedQuery.isBlank() || translatedQuery.equalsIgnoreCase(originalQuery)) {
            return Mono.just("");
        }
        return translateOne(translatedQuery, "ko")
                .map(roundTrip -> PlaceTextSimilarity.score(originalQuery, roundTrip) >= 0.48 ? translatedQuery : "")
                .onErrorReturn("");
    }

    public Mono<List<PlaceItem>> localizeResults(List<PlaceItem> items) {
        if (items == null || items.isEmpty() || !canTranslate()) return Mono.just(items == null ? List.of() : items);

        List<String> titles = items.stream()
                .filter(item -> !containsHangul(item.titleKo()))
                .map(this::translationSource)
                .filter(title -> title != null && !title.isBlank() && !containsHangul(title))
                .distinct()
                .limit(MAX_RESULT_TITLES)
                .toList();
        List<String> photonAddresses = items.stream()
                .filter(this::isPhoton)
                .map(PlaceItem::subtitle)
                .filter(value -> value != null && !value.isBlank() && !containsHangul(value))
                .distinct()
                .limit(MAX_RESULT_TITLES)
                .toList();
        List<String> translationTargets = new ArrayList<>(titles);
        photonAddresses.stream().filter(value -> !translationTargets.contains(value)).forEach(translationTargets::add);
        if (translationTargets.isEmpty()) return Mono.just(items);

        return translateBatch(translationTargets, "ko")
                .flatMap(translations -> validateAndLocalize(items, translations))
                .onErrorReturn(items);
    }

    private Mono<List<PlaceItem>> validateAndLocalize(List<PlaceItem> items, Map<String, String> koreanTranslations) {
        List<String> missingEnglishReferences = items.stream()
                .filter(item -> !containsHangul(item.titleKo()))
                .filter(item -> item.titleEn() == null || item.titleEn().isBlank())
                .map(PlaceItem::title)
                .filter(title -> title != null && !title.isBlank())
                .distinct()
                .toList();
        List<String> translatedKoreanTitles = koreanTranslations.values().stream()
                .filter(this::containsHangul)
                .distinct()
                .toList();

        Mono<Map<String, String>> references = missingEnglishReferences.isEmpty()
                ? Mono.just(Map.of())
                : translateBatch(missingEnglishReferences, "en");
        Mono<Map<String, String>> roundTrips = translatedKoreanTitles.isEmpty()
                ? Mono.just(Map.of())
                : translateBatch(translatedKoreanTitles, "en");

        return Mono.zip(references, roundTrips)
                .map(pair -> items.stream()
                        .map(item -> localizeItem(item, koreanTranslations, pair.getT1(), pair.getT2()))
                        .toList());
    }

    private Mono<String> translateOne(String text, String targetLanguage) {
        return translateBatch(List.of(text), targetLanguage)
                .map(translations -> translations.getOrDefault(text, text));
    }

    private Mono<Map<String, String>> translateBatch(List<String> texts, String targetLanguage) {
        Map<String, String> translated = new LinkedHashMap<>();
        List<String> misses = new ArrayList<>();
        for (String text : texts) {
            String cached = readCache(text, targetLanguage);
            if (cached == null) misses.add(text);
            else translated.put(text, cached);
        }
        if (misses.isEmpty()) return Mono.just(translated);

        Map<String, Object> body = Map.of(
                "q", misses,
                "source", sourceLanguage(misses),
                "target", targetLanguage,
                "format", "text"
        );
        return webClient.post()
                .uri("/translate")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .timeout(REQUEST_TIMEOUT)
                .map(response -> parseTranslations(response, misses))
                .map(remote -> {
                    translated.putAll(remote);
                    remote.forEach((source, value) -> writeCache(source, targetLanguage, value));
                    return translated;
                })
                .onErrorResume(error -> {
                    disabledUntil.set(System.currentTimeMillis() + ERROR_COOLDOWN_MILLIS);
                    log.warn("Local place translation unavailable; pausing calls for 1 minute: {}", error.getMessage());
                    misses.forEach(text -> translated.put(text, text));
                    return Mono.just(translated);
                });
    }

    private Map<String, String> parseTranslations(Map<String, Object> response, List<String> sources) {
        Map<String, String> result = new LinkedHashMap<>();
        Object translatedText = response.get("translatedText");
        if (translatedText instanceof List<?> translations) {
            for (int i = 0; i < Math.min(sources.size(), translations.size()); i++) {
                String text = translations.get(i) == null ? "" : String.valueOf(translations.get(i)).trim();
                if (!text.isBlank()) result.put(sources.get(i), text);
            }
        } else if (sources.size() == 1 && translatedText != null) {
            String text = String.valueOf(translatedText).trim();
            if (!text.isBlank()) result.put(sources.get(0), text);
        }
        return result;
    }

    private PlaceItem localizeItem(
            PlaceItem item,
            Map<String, String> translations,
            Map<String, String> generatedEnglishReferences,
            Map<String, String> roundTrips
    ) {
        if (containsHangul(item.titleKo()) || containsHangul(item.title())) return localizePhotonSubtitle(item, translations);
        String source = translationSource(item);
        String translatedTitle = translations.get(source);
        if (translatedTitle == null || translatedTitle.isBlank() || translatedTitle.equals(item.title())) return localizePhotonSubtitle(item, translations);
        if (isGenericTranslatedTitle(translatedTitle)) return localizePhotonSubtitle(item, translations);
        String englishReference = item.titleEn() != null && !item.titleEn().isBlank()
                ? item.titleEn()
                : generatedEnglishReferences.get(item.title());
        String roundTrip = roundTrips.get(translatedTitle);
        boolean verified = PlaceTextSimilarity.score(englishReference, roundTrip) >= 0.48;
        if (!verified) return localizePhotonSubtitle(item, translations);
        PlaceItem localized = new PlaceItem(
                item.id(),
                item.title(),
                bilingualTitle(translatedTitle, item.title(), item.displayTitle()),
                translatedTitle,
                item.titleEn(),
                item.titleJa(),
                localizedSubtitle(item, translations),
                item.lat(),
                item.lon(),
                item.importance(),
                item.sourceQuery(),
                item.category(),
                item.type()
        );
        return localized;
    }

    private PlaceItem localizePhotonSubtitle(PlaceItem item, Map<String, String> translations) {
        String subtitle = localizedSubtitle(item, translations);
        if (subtitle.equals(item.subtitle())) return item;
        return new PlaceItem(item.id(), item.title(), item.displayTitle(), item.titleKo(), item.titleEn(),
                item.titleJa(), subtitle, item.lat(), item.lon(), item.importance(), item.sourceQuery(), item.category(), item.type());
    }

    private String localizedSubtitle(PlaceItem item, Map<String, String> translations) {
        if (!isPhoton(item) || item.subtitle() == null || item.subtitle().isBlank() || containsHangul(item.subtitle())) {
            return item.subtitle();
        }
        String translated = translations.get(item.subtitle());
        return translated != null && containsHangul(translated) ? translated : item.subtitle();
    }

    private boolean isPhoton(PlaceItem item) {
        return item != null && item.id() != null && item.id().startsWith("photon:");
    }

    private boolean isGenericTranslatedTitle(String value) {
        if (value == null) return true;
        String normalized = value.toLowerCase(Locale.ROOT).replaceAll("[\\s&·/|_-]+", "");
        return Set.of("호텔", "료칸", "호텔료칸", "숙박", "숙박시설", "호텔및료칸", "hotels", "ryokan", "hotelsryokan",
                        "한국어", "일본어", "영어", "korean", "japanese", "english")
                .contains(normalized);
    }

    private String bilingualTitle(String translatedTitle, String originalTitle, String currentDisplayTitle) {
        String original = originalTitle == null || originalTitle.isBlank() ? currentDisplayTitle : originalTitle;
        if (original == null || original.isBlank() || translatedTitle.equalsIgnoreCase(original)) return translatedTitle;
        return translatedTitle + " (" + original + ")";
    }

    private boolean canTranslate() {
        return enabled && System.currentTimeMillis() >= disabledUntil.get();
    }

    private String sourceLanguage(List<String> texts) {
        return texts.stream().allMatch(this::containsHangul) ? "ko" : "auto";
    }

    private String translationSource(PlaceItem item) {
        if (item.titleEn() != null && !item.titleEn().isBlank() && !containsHangul(item.titleEn())) {
            return item.titleEn();
        }
        return item.title();
    }

    private String readCache(String text, String targetLanguage) {
        try {
            return redisTemplate.opsForValue().get(cacheKey(text, targetLanguage));
        } catch (Exception ignored) {
            return null;
        }
    }

    private void writeCache(String text, String targetLanguage, String translation) {
        try {
            redisTemplate.opsForValue().set(cacheKey(text, targetLanguage), translation, CACHE_TTL);
        } catch (Exception ignored) {
            // Translation remains available when Redis is temporarily unavailable.
        }
    }

    private String cacheKey(String text, String targetLanguage) {
        return "place:translation:v1:" + targetLanguage.toLowerCase(Locale.ROOT) + ":" + sha256(text);
    }

    private String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (Exception ignored) {
            return Integer.toHexString(text.hashCode());
        }
    }

    private void addIfUseful(Set<String> variants, String value) {
        if (value != null && !value.isBlank()) variants.add(value.trim());
    }

    private boolean containsHangul(String value) {
        return value != null && value.codePoints().anyMatch(codePoint -> codePoint >= 0xAC00 && codePoint <= 0xD7A3);
    }
}
