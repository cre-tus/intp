package com.infp.place.service;

import com.infp.place.dto.PlaceItem;
import com.infp.place.entity.PlaceMemoryEntity;
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
        double score = item.importance();

        if (title.equals(normalizedQuery) || displayTitle.equals(normalizedQuery)) score += 6.0;
        if (title.startsWith(normalizedQuery) || displayTitle.startsWith(normalizedQuery)) score += 4.0;
        if (title.contains(normalizedQuery) || displayTitle.contains(normalizedQuery)) score += 2.5;
        if (subtitle.contains(normalizedQuery)) score += 0.8;

        for (String token : normalizedQuery.split(" ")) {
            if (token.isBlank()) continue;
            if (title.contains(token) || displayTitle.contains(token)) score += 0.7;
            if (subtitle.contains(token)) score += 0.2;
        }

        return score;
    }

    public double scoreMemory(String query, PlaceMemoryEntity place) {
        double score = score(query, toPlaceItem(place));
        score += Math.log1p(Math.max(0, place.getSelectionCount())) * 1.8;
        score += recencyBoost(place.getLastSelectedAt());
        return score;
    }

    private double recencyBoost(LocalDateTime lastSelectedAt) {
        if (lastSelectedAt == null) return 0;
        long days = Math.max(0, Duration.between(lastSelectedAt, LocalDateTime.now()).toDays());
        if (days <= 7) return 1.2;
        if (days <= 30) return 0.7;
        if (days <= 90) return 0.3;
        return 0;
    }

    private PlaceItem toPlaceItem(PlaceMemoryEntity place) {
        return new PlaceItem(
                place.getSource() + ":" + place.getSourcePlaceId(),
                place.getTitle(),
                place.getDisplayTitle(),
                place.getTitleKo(),
                place.getTitleEn(),
                place.getTitleJa(),
                place.getSubtitle(),
                place.getLat(),
                place.getLon(),
                Math.log1p(Math.max(0, place.getSelectionCount())),
                place.getSelectedQuery()
        );
    }

    static String normalize(String value) {
        return value == null
                ? ""
                : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
