package com.infp.place.service;

import com.infp.place.dto.PlaceItem;
import com.infp.place.dto.PlaceSelectionRequest;
import com.infp.place.entity.PlaceMemoryEntity;
import com.infp.place.repository.PlaceMemoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class PlaceMemoryService {
    private final PlaceMemoryRepository repository;
    private final PlaceRankingModel rankingModel;

    public PlaceMemoryService(PlaceMemoryRepository repository, PlaceRankingModel rankingModel) {
        this.repository = repository;
        this.rankingModel = rankingModel;
    }

    public List<PlaceItem> search(String query, int limit) {
        String normalized = normalize(query);
        if (normalized.isBlank()) return List.of();
        return repository.searchMemory(normalized, Math.max(10, limit * 3)).stream()
                .sorted(Comparator.comparingDouble((PlaceMemoryEntity item) -> rankingModel.scoreMemory(query, item)).reversed())
                .limit(limit)
                .map(this::toPlaceItem)
                .toList();
    }

    @Transactional
    public void recordSelection(PlaceSelectionRequest request) {
        if (request == null || request.place() == null) return;
        PlaceItem place = request.place();
        if (!hasValidCoordinates(place.lat(), place.lon())) return;

        String source = normalizeSource(request.provider(), place.id());
        String sourcePlaceId = normalizeSourcePlaceId(place.id(), place.lat(), place.lon());
        String title = firstNonBlank(place.title(), place.displayTitle(), place.titleKo(), place.titleEn(), place.titleJa(), sourcePlaceId);
        PlaceMemoryEntity entity = repository.findBySourceAndSourcePlaceId(source, sourcePlaceId)
                .orElseGet(PlaceMemoryEntity::new);

        entity.setSource(source);
        entity.setSourcePlaceId(sourcePlaceId);
        entity.setTitle(limit(title, 220));
        entity.setDisplayTitle(limit(blankToNull(place.displayTitle()), 320));
        entity.setTitleKo(limit(blankToNull(place.titleKo()), 220));
        entity.setTitleEn(limit(blankToNull(place.titleEn()), 220));
        entity.setTitleJa(limit(blankToNull(place.titleJa()), 220));
        entity.setSubtitle(limit(blankToNull(place.subtitle()), 600));
        entity.setLat(place.lat());
        entity.setLon(place.lon());
        entity.setSelectedQuery(limit(blankToNull(request.query()), 500));
        entity.setNormalizedText(normalizedText(place, request.query()));
        entity.setSelectionCount(Math.max(0, entity.getSelectionCount()) + 1);
        entity.setLastSelectedAt(LocalDateTime.now());

        repository.save(entity);
    }

    private PlaceItem toPlaceItem(PlaceMemoryEntity entity) {
        return new PlaceItem(
                entity.getSource() + ":" + entity.getSourcePlaceId(),
                entity.getTitle(),
                entity.getDisplayTitle(),
                entity.getTitleKo(),
                entity.getTitleEn(),
                entity.getTitleJa(),
                entity.getSubtitle(),
                entity.getLat(),
                entity.getLon(),
                Math.log1p(Math.max(0, entity.getSelectionCount())),
                entity.getSelectedQuery()
        );
    }

    private String normalizedText(PlaceItem place, String query) {
        return normalize(String.join(" ",
                nullToBlank(place.title()),
                nullToBlank(place.displayTitle()),
                nullToBlank(place.titleKo()),
                nullToBlank(place.titleEn()),
                nullToBlank(place.titleJa()),
                nullToBlank(place.subtitle()),
                nullToBlank(query)
        ));
    }

    private String normalizeSource(String provider, String placeId) {
        String value = placeId == null || placeId.isBlank() ? provider : placeId;
        if (value == null) return "MANUAL";
        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.startsWith("google")) return "GOOGLE";
        if (lower.startsWith("place")) return "NOMINATIM";
        if (lower.startsWith("manual")) return "MANUAL";
        if (provider != null && provider.equalsIgnoreCase("local")) return "LOCAL";
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeSourcePlaceId(String placeId, double lat, double lon) {
        if (placeId != null && !placeId.isBlank()) {
            int index = placeId.indexOf(':');
            return index >= 0 ? placeId.substring(index + 1) : placeId;
        }
        return String.format(Locale.ROOT, "%.6f,%.6f", lat, lon);
    }

    private boolean hasValidCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private String normalize(String value) {
        return PlaceRankingModel.normalize(value);
    }

    private String limit(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "place";
    }
}
