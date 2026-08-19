package com.infp.place.service;

import com.infp.place.dto.PlaceItem;
import com.infp.place.entity.PlaceMemoryEntity;
import com.infp.place.util.KoreanPlaceNameResolver;
import com.infp.place.util.PlaceTextSimilarity;
import com.infp.place.util.QueryVariantBuilder;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

@Component
public class PlaceRankingModel {
    public double score(String query, PlaceItem item) {
        String normalizedQuery = normalize(query);
        String title = normalize(item.title());
        String displayTitle = normalize(item.displayTitle());
        String subtitle = normalize(item.subtitle());
        double score = Math.log1p(Math.max(0.0, item.importance())) * 0.8;

        if (title.equals(normalizedQuery) || displayTitle.equals(normalizedQuery)) score += 6.0;
        if (title.startsWith(normalizedQuery) || displayTitle.startsWith(normalizedQuery)) score += 4.0;
        if (title.contains(normalizedQuery) || displayTitle.contains(normalizedQuery)) score += 2.5;
        if (subtitle.contains(normalizedQuery)) score += 0.8;

        for (String token : normalizedQuery.split(" ")) {
            if (token.isBlank()) continue;
            if (title.contains(token) || displayTitle.contains(token)) score += 0.7;
            if (subtitle.contains(token)) score += 0.2;
        }

        if (PlaceTextSimilarity.compact(query).length() >= 2) {
            double titleSimilarity = java.util.stream.Stream.of(
                            item.title(), item.displayTitle(), item.titleKo(), item.titleEn(), item.titleJa()
                    )
                    .mapToDouble(candidate -> PlaceTextSimilarity.score(query, candidate))
                    .max()
                    .orElse(0.0);
            score += titleSimilarity * 4.0;
            if (titleSimilarity >= 0.88) score += 1.5;
            score += PlaceTextSimilarity.score(query, item.subtitle()) * 0.8;
        }

        return score;
    }

    public double scoreMemory(String query, PlaceMemoryEntity place) {
        double score = scoreWithVariants(query, toPlaceItem(place, query));
        score += Math.min(2.0, Math.log1p(Math.max(0, place.getSelectionCount())) * 0.8);
        score += recencyBoost(place.getLastSelectedAt());
        return score;
    }

    public double scoreWithVariants(String query, PlaceItem item) {
        double best = score(query, item);
        for (String variant : QueryVariantBuilder.build(query)) {
            if (variant.equalsIgnoreCase(query)) continue;
            best = Math.max(best, score(variant, item) * 0.92);
        }
        return best;
    }

    private double recencyBoost(LocalDateTime lastSelectedAt) {
        if (lastSelectedAt == null) return 0;
        long days = Math.max(0, Duration.between(lastSelectedAt, LocalDateTime.now()).toDays());
        if (days <= 7) return 1.2;
        if (days <= 30) return 0.7;
        if (days <= 90) return 0.3;
        return 0;
    }

    private PlaceItem toPlaceItem(PlaceMemoryEntity place, String query) {
        String titleKo = KoreanPlaceNameResolver.resolveTitle(
                place.getTitleKo(), query, place.getTitle(), place.getTitleEn(), place.getTitleJa(), place.getSubtitle()
        );
        String title = titleKo.isBlank() ? place.getTitle() : titleKo;
        String displayTitle = titleKo.isBlank() ? place.getDisplayTitle() : titleKo;
        return new PlaceItem(
                place.getSource() + ":" + place.getSourcePlaceId(),
                title,
                displayTitle,
                titleKo,
                place.getTitleEn(),
                place.getTitleJa(),
                KoreanPlaceNameResolver.localizeSubtitle(place.getSubtitle()),
                place.getLat(),
                place.getLon(),
                Math.log1p(Math.max(0, place.getSelectionCount())),
                place.getSelectedQuery(),
                place.getCategory(),
                place.getPlaceType()
        );
    }

    static String normalize(String value) {
        return value == null
                ? ""
                : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    static String fuzzyPrefix(String value) {
        return PlaceTextSimilarity.searchPrefix(value, 3);
    }
}
