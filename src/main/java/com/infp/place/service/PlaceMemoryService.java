package com.infp.place.service;

import com.infp.place.dto.PlaceItem;
import com.infp.place.dto.PlaceSelectionRequest;
import com.infp.place.entity.PlaceMemoryEntity;
import com.infp.place.entity.PlaceSearchLearningEntity;
import com.infp.place.repository.PlaceMemoryRepository;
import com.infp.place.repository.PlaceSearchLearningRepository;
import com.infp.place.util.KoreanPlaceNameResolver;
import com.infp.place.util.QueryVariantBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Sort;

@Service
public class PlaceMemoryService {
    private static final int NORMALIZED_TEXT_MAX_LENGTH = 1200;
    private final PlaceMemoryRepository repository;
    private final PlaceSearchLearningRepository learningRepository;
    private final PlaceRankingModel rankingModel;
    private final PlaceSearchCacheVersion cacheVersion;
    private final com.infp.admin.AdminMlIngestService adminMlIngestService;
    private final com.infp.travel.TravelPlanPlaceMergeService travelPlanPlaceMergeService;

    public PlaceMemoryService(
            PlaceMemoryRepository repository,
            PlaceSearchLearningRepository learningRepository,
            PlaceRankingModel rankingModel,
            PlaceSearchCacheVersion cacheVersion,
            com.infp.admin.AdminMlIngestService adminMlIngestService,
            com.infp.travel.TravelPlanPlaceMergeService travelPlanPlaceMergeService
    ) {
        this.repository = repository;
        this.learningRepository = learningRepository;
        this.rankingModel = rankingModel;
        this.cacheVersion = cacheVersion;
        this.adminMlIngestService = adminMlIngestService;
        this.travelPlanPlaceMergeService = travelPlanPlaceMergeService;
    }

    @Transactional(readOnly = true)
    public List<PlaceItem> search(String query, String countryCode, int limit) {
        String normalized = normalize(query);
        if (normalized.isBlank()) return List.of();
        String country = normalizeCountry(countryCode);

        Map<Long, PlaceMemoryEntity> matches = new LinkedHashMap<>();
        QueryVariantBuilder.build(query).stream().limit(6).forEach((variant) -> {
            String normalizedVariant = normalize(variant);
            repository.searchMemory(normalizedVariant, compact(normalizedVariant), country, Math.max(10, limit * 2))
                    .forEach((entity) -> matches.putIfAbsent(entity.getId(), entity));
        });
        if (matches.isEmpty()) {
            String prefix = PlaceRankingModel.fuzzyPrefix(query);
            if (prefix.length() >= 2) {
                repository.searchFuzzyCandidates(prefix, country, Math.max(30, limit * 4))
                        .forEach((entity) -> matches.putIfAbsent(entity.getId(), entity));
            }
        }
        return matches.values().stream()
                .sorted(Comparator.comparingDouble((PlaceMemoryEntity item) -> rankingModel.scoreMemory(query, item)).reversed())
                .limit(limit)
                .map((entity) -> toPlaceItem(entity, query))
                .toList();
    }

    @Transactional
    public void recordSelection(PlaceSelectionRequest request) {
        if (request == null || request.place() == null) return;
        if (isPhoton(request.place(), request.provider())) return;
        PlaceMemoryEntity memory = upsertMemory(request.place(), request.query(), request.provider(), true);
        upsertLearning(request.place(), request.query(), request.provider(), request.countryCode(), true, memory);
        cacheVersion.advance();
    }

    public record PlaceDatasetPageResponse(
            long totalCount,
            int page,
            int pageSize,
            int totalPages,
            List<PlaceDatasetItem> items
    ) {}

    @Transactional(readOnly = true)
    public PlaceDatasetPageResponse adminDatasetPage(String query, int page, int pageSize, String sort, String reviewStatus, String source, String category, String placeType) {
        String needle = normalize(query);
        String normalizedReviewStatus = nullToBlank(reviewStatus).toLowerCase(Locale.ROOT);
        String normalizedSource = nullToBlank(source).trim().toUpperCase(Locale.ROOT);
        String normalizedCategory = nullToBlank(category).trim().toLowerCase(Locale.ROOT);
        String normalizedType = nullToBlank(placeType).trim().toLowerCase(Locale.ROOT);

        java.util.Set<Long> duplicateIds = new java.util.HashSet<>();
        if ("duplicate".equals(normalizedReviewStatus)) {
            List<PlaceMemoryEntity> allEntities = repository.findAll();
            for (int i = 0; i < allEntities.size(); i++) {
                PlaceMemoryEntity a = allEntities.get(i);
                for (int j = i + 1; j < allEntities.size(); j++) {
                    PlaceMemoryEntity b = allEntities.get(j);

                    boolean sameGoogle = !nullToBlank(a.getGooglePlaceId()).isBlank()
                            && nullToBlank(a.getGooglePlaceId()).equalsIgnoreCase(nullToBlank(b.getGooglePlaceId()));

                    boolean sameSourceId = !nullToBlank(a.getSourcePlaceId()).isBlank()
                            && nullToBlank(a.getSourcePlaceId()).equalsIgnoreCase(nullToBlank(b.getSourcePlaceId()));

                    String titleA = normalize(firstNonBlank(a.getTitleKo(), a.getDisplayTitle(), a.getTitle()));
                    String titleB = normalize(firstNonBlank(b.getTitleKo(), b.getDisplayTitle(), b.getTitle()));
                    boolean sameTitle = !titleA.isBlank() && titleA.length() >= 2 && titleA.equals(titleB);

                    double distMeters = distanceMeters(a.getLat(), a.getLon(), b.getLat(), b.getLon());
                    boolean closeDistance = distMeters <= 500.0;

                    if (sameGoogle || sameSourceId || (sameTitle && closeDistance)) {
                        duplicateIds.add(a.getId());
                        duplicateIds.add(b.getId());
                    }
                }
            }
        }

        Comparator<PlaceMemoryEntity> order = switch (nullToBlank(sort).toLowerCase(Locale.ROOT)) {
            case "review_desc" -> Comparator.comparingInt(PlaceMemoryEntity::getReviewCount).reversed()
                    .thenComparing(PlaceMemoryEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
            case "selection_asc" -> Comparator.comparingInt(PlaceMemoryEntity::getSelectionCount)
                    .thenComparing(PlaceMemoryEntity::getLastSelectedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                    .thenComparing(PlaceMemoryEntity::getUpdatedAt, Comparator.nullsFirst(Comparator.naturalOrder()));
            case "selection_desc" -> Comparator.comparingInt(PlaceMemoryEntity::getSelectionCount).reversed()
                    .thenComparing(PlaceMemoryEntity::getLastSelectedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(PlaceMemoryEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
            case "updated_desc" -> Comparator.comparing(PlaceMemoryEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
            default -> Comparator.comparingInt(PlaceMemoryEntity::getReviewCount)
                    .thenComparing(PlaceMemoryEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        };
        List<PlaceMemoryEntity> filtered = repository.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
                .filter(item -> item.getSelectionCount() > 0)
                .filter(item -> needle.isBlank() || normalize(String.join(" ",
                        nullToBlank(item.getTitle()), nullToBlank(item.getDisplayTitle()),
                        nullToBlank(item.getTitleKo()), nullToBlank(item.getTitleEn()),
                        nullToBlank(item.getTitleJa()), nullToBlank(item.getSubtitle()),
                        nullToBlank(item.getCategory()), nullToBlank(item.getPlaceType()),
                        nullToBlank(item.getSelectedQuery()), nullToBlank(item.getSourcePlaceId())
                )).contains(needle))
                .filter(item -> switch (normalizedReviewStatus) {
                    case "unreviewed" -> item.getReviewCount() == 0;
                    case "reviewed" -> item.getReviewCount() > 0;
                    case "duplicate" -> duplicateIds.contains(item.getId());
                    default -> true;
                })
                .filter(item -> switch (normalizedSource) {
                    case "GOOGLE" -> "GOOGLE".equalsIgnoreCase(nullToBlank(item.getSource()));
                    case "CUSTOM" -> "CUSTOM".equalsIgnoreCase(nullToBlank(item.getSource()))
                            || (item.getGooglePlaceId() != null && !item.getGooglePlaceId().isBlank() && !"GOOGLE".equalsIgnoreCase(item.getSource()));
                    default -> true;
                })
                .filter(item -> normalizedCategory.isBlank() || "all".equals(normalizedCategory) || normalizedCategory.equalsIgnoreCase(nullToBlank(item.getCategory())))
                .filter(item -> normalizedType.isBlank() || "all".equals(normalizedType) || normalizedType.equalsIgnoreCase(nullToBlank(item.getPlaceType())))
                .sorted(order)
                .toList();

        long totalCount = filtered.size();
        int validPageSize = Math.max(10, Math.min(pageSize, 200));
        int totalPages = Math.max(1, (int) Math.ceil((double) totalCount / validPageSize));
        int validPage = Math.max(1, Math.min(page, totalPages));

        int fromIndex = (validPage - 1) * validPageSize;
        int toIndex = Math.min(fromIndex + validPageSize, (int) totalCount);

        List<PlaceDatasetItem> items = (fromIndex < totalCount)
                ? filtered.subList(fromIndex, toIndex).stream().map(this::toDatasetItem).toList()
                : List.of();

        return new PlaceDatasetPageResponse(totalCount, validPage, validPageSize, totalPages, items);
    }

    @Transactional(readOnly = true)
    public PlaceDatasetPageResponse adminDatasetPage(String query, int page, int pageSize, String sort, String reviewStatus, String source) {
        return adminDatasetPage(query, page, pageSize, sort, reviewStatus, source, "all", "all");
    }

    @Transactional(readOnly = true)
    public List<PlaceDatasetItem> adminDataset(String query, int limit, String sort, String reviewStatus, String source) {
        return adminDatasetPage(query, 1, limit, sort, reviewStatus, source, "all", "all").items();
    }

    @Transactional
    public PlaceDatasetItem adminRelabel(long id, PlaceDatasetUpdate update) {
        PlaceMemoryEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("장소 데이터가 없습니다."));
        if (update == null || !hasValidCoordinates(update.lat(), update.lon())) {
            throw new IllegalArgumentException("유효한 위도와 경도를 입력하세요.");
        }
        String previousSource = entity.getSource();
        entity.setTitle(limit(firstNonBlank(update.title(), update.displayTitle(), entity.getTitle()), 220));
        entity.setDisplayTitle(limit(blankToNull(update.displayTitle()), 320));
        entity.setTitleKo(limit(blankToNull(update.titleKo()), 220));
        entity.setTitleEn(limit(blankToNull(update.titleEn()), 220));
        entity.setTitleJa(limit(blankToNull(update.titleJa()), 220));
        entity.setSubtitle(limit(blankToNull(update.subtitle()), 600));
        entity.setCategory(normalizeNominatimField(update.category(), "place", 80));
        entity.setPlaceType(normalizeNominatimField(update.placeType(), "unknown", 120));
        entity.setLat(update.lat());
        entity.setLon(update.lon());
        entity.setReviewCount(Math.max(0, entity.getReviewCount()) + 1);
        boolean promoteToCustom = "NOMINATIM".equalsIgnoreCase(previousSource);
        if (promoteToCustom) {
            entity.setSource("CUSTOM");
            entity.setSourceDataExpiresAt(null);
        }
        PlaceItem relabeled = new PlaceItem(entity.getSource() + ":" + entity.getSourcePlaceId(), entity.getTitle(),
                entity.getDisplayTitle(), entity.getTitleKo(), entity.getTitleEn(), entity.getTitleJa(), entity.getSubtitle(),
                entity.getLat(), entity.getLon(), 0, update.selectedQuery(), entity.getCategory(), entity.getPlaceType());
        String rebuiltAliases = rebuildAdminAliases(update.selectedQuery(), relabeled);
        entity.setSelectedQuery(limit(rebuiltAliases, 500));
        entity.setNormalizedText(limit(normalizedText(relabeled, rebuiltAliases), NORMALIZED_TEXT_MAX_LENGTH));
        if (promoteToCustom) {
            List<PlaceSearchLearningEntity> learningRows = learningRepository
                    .findAllBySourceAndSourcePlaceId(previousSource, entity.getSourcePlaceId());
            learningRows.forEach(row -> row.setSource("CUSTOM"));
            learningRepository.saveAll(learningRows);
        }
        PlaceMemoryEntity savedEntity = repository.saveAndFlush(entity);
        ensureSearchLearning(savedEntity, firstNonBlank(rebuiltAliases, update.selectedQuery(),
                savedEntity.getTitleKo(), savedEntity.getDisplayTitle(), savedEntity.getTitle()), "JP");
        PlaceDatasetItem saved = toDatasetItem(savedEntity);
        adminMlIngestService.syncSeedCoordinates(
                firstNonBlank(savedEntity.getTitleKo(), savedEntity.getDisplayTitle(), savedEntity.getTitle()),
                savedEntity.getLat(), savedEntity.getLon(), promoteToCustom ? "custom" : nullToBlank(savedEntity.getSource()).toLowerCase(Locale.ROOT));
        cacheVersion.advance();
        return saved;
    }

    @Transactional
    public PlaceDatasetItem replaceGoogleWithNominatim(long id, PlaceDatasetReplacement replacement) {
        PlaceMemoryEntity google = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("장소 데이터가 없습니다."));
        PlaceItem place = replacement == null ? null : replacement.place();
        if (place == null || !hasValidCoordinates(place.lat(), place.lon())
                || place.id() == null
                || !(place.id().toLowerCase(Locale.ROOT).startsWith("place:")
                || place.id().toLowerCase(Locale.ROOT).startsWith("nominatim:"))) {
            throw new IllegalArgumentException("Nominatim 검색 결과를 선택하세요.");
        }

        String originalSource = google.getSource();
        String originalSourcePlaceId = google.getSourcePlaceId();
        String nominatimId = normalizeSourcePlaceId(place.id(), place.lat(), place.lon());
        String googlePlaceId = firstNonBlank(google.getGooglePlaceId(), google.getSourcePlaceId());
        // Nominatim 결과는 좌표/주소 참고값이다. 공항 내부 점포처럼 같은 OSM 객체를
        // 선택해도 기존 CUSTOM 장소와 병합하지 않고 현재 행을 독립 장소로 유지한다.
        String customSourcePlaceId = repository.findBySourceAndSourcePlaceId("CUSTOM", nominatimId)
                .filter(existing -> !existing.getId().equals(google.getId()))
                .map(existing -> limit(nominatimId + "-custom-" + google.getId(), 180))
                .orElse(nominatimId);
        PlaceMemoryEntity target = google;
        int reviewCount = Math.max(target.getReviewCount(), google.getReviewCount()) + 1;
        int selectionCount = Math.max(1, Math.max(target.getSelectionCount(), google.getSelectionCount()));
        LocalDateTime lastSelectedAt = latest(target.getLastSelectedAt(), google.getLastSelectedAt());

        target.setSource("CUSTOM");
        target.setSourcePlaceId(customSourcePlaceId);
        target.setGooglePlaceId(googlePlaceId);
        target.setSourceDataExpiresAt(null);
        target.setTitle(google.getTitle());
        target.setDisplayTitle(google.getDisplayTitle());
        target.setTitleKo(google.getTitleKo());
        target.setTitleEn(google.getTitleEn());
        target.setTitleJa(google.getTitleJa());
        target.setSubtitle(limit(blankToNull(place.subtitle()), 600));
        target.setCategory(normalizeNominatimField(place.category(), "place", 80));
        target.setPlaceType(normalizeNominatimField(place.type(), "unknown", 120));
        target.setLat(place.lat());
        target.setLon(place.lon());
        target.setSelectedQuery(google.getSelectedQuery());
        target.setSelectionCount(selectionCount);
        target.setReviewCount(reviewCount);
        target.setLastSelectedAt(lastSelectedAt);
        PlaceItem localPlace = new PlaceItem(
                "place:" + nominatimId,
                target.getTitle(), target.getDisplayTitle(), target.getTitleKo(), target.getTitleEn(), target.getTitleJa(),
                target.getSubtitle(), target.getLat(), target.getLon(), place.importance(), target.getSelectedQuery(),
                target.getCategory(), target.getPlaceType()
        );
        target.setNormalizedText(limit(normalizedText(localPlace, target.getSelectedQuery()), NORMALIZED_TEXT_MAX_LENGTH));

        migrateSearchLearning(originalSource, originalSourcePlaceId, target);
        PlaceMemoryEntity saved = repository.saveAndFlush(target);
        travelPlanPlaceMergeService.replacePlace(originalSource, originalSourcePlaceId, saved);
        String learningQuery = firstNonBlank(
                replacement.query(), target.getSelectedQuery(), target.getTitleKo(), target.getDisplayTitle(), target.getTitle());
        upsertLearning(localPlace, learningQuery, "nominatim", replacement.countryCode(), false, saved);
        ensureSearchLearning(saved, learningQuery, replacement.countryCode());
        adminMlIngestService.syncSeedCoordinates(
                firstNonBlank(saved.getTitleKo(), saved.getDisplayTitle(), saved.getTitle()),
                saved.getLat(), saved.getLon(), "nominatim");
        cacheVersion.advance();
        return toDatasetItem(saved);
    }

    @Transactional
    public PlaceDatasetDeleteResult adminDelete(long id) {
        PlaceMemoryEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("장소 데이터가 없습니다."));
        long learningRows = learningRepository.deleteBySourceAndSourcePlaceId(entity.getSource(), entity.getSourcePlaceId());
        repository.delete(entity);
        repository.flush();
        cacheVersion.advance();
        return new PlaceDatasetDeleteResult(id, learningRows);
    }

    private PlaceDatasetItem toDatasetItem(PlaceMemoryEntity entity) {
        return new PlaceDatasetItem(entity.getId(), entity.getSource(), entity.getSourcePlaceId(), entity.getGooglePlaceId(), entity.getTitle(),
                entity.getDisplayTitle(), entity.getTitleKo(), entity.getTitleEn(), entity.getTitleJa(), entity.getSubtitle(),
                entity.getCategory(), entity.getPlaceType(),
                entity.getLat(), entity.getLon(), entity.getSelectedQuery(), entity.getSelectionCount(),
                entity.getReviewCount(), entity.getSourceDataExpiresAt(), entity.getLastSelectedAt(), entity.getUpdatedAt());
    }

    public record PlaceDatasetItem(Long id, String source, String sourcePlaceId, String googlePlaceId, String title, String displayTitle,
            String titleKo, String titleEn, String titleJa, String subtitle, String category, String placeType, double lat, double lon,
            String selectedQuery, int selectionCount, int reviewCount, LocalDateTime sourceDataExpiresAt,
            LocalDateTime lastSelectedAt, LocalDateTime updatedAt) {}

    public record PlaceDatasetUpdate(String title, String displayTitle, String titleKo, String titleEn,
            String titleJa, String subtitle, String category, String placeType, double lat, double lon, String selectedQuery) {}

    public record PlaceDatasetReplacement(PlaceItem place, String query, String countryCode) {}

    @Transactional
    public PlaceDatasetItem adminMerge(PlaceDatasetMergeRequest request) {
        long targetId = request.targetId();
        long sourceId = request.sourceId();
        java.util.Map<String, String> choices = request.fieldChoices();

        if (targetId == sourceId) {
            throw new IllegalArgumentException("동일한 장소를 병합할 수 없습니다.");
        }
        PlaceMemoryEntity target = repository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("기준 장소 데이터(ID: " + targetId + ")가 없습니다."));
        PlaceMemoryEntity source = repository.findById(sourceId)
                .orElseThrow(() -> new IllegalArgumentException("병합 대상 장소 데이터(ID: " + sourceId + ")가 없습니다."));

        // Helper: pick value from A (target) or B (source) based on fieldChoices
        // choice "A" = keep target value, "B" = override with source value
        java.util.function.BiFunction<String, String, String> pick = (field, targetVal) ->
                "B".equalsIgnoreCase(choices.getOrDefault(field, "A")) ? null : targetVal;

        // Counts are always summed
        target.setSelectionCount(Math.max(1, target.getSelectionCount() + source.getSelectionCount()));
        target.setReviewCount(target.getReviewCount() + source.getReviewCount());
        target.setLastSelectedAt(latest(target.getLastSelectedAt(), source.getLastSelectedAt()));

        // Apply field choices — if choice is B, use source value; otherwise keep/enrich target
        applyFieldChoice(choices, "title", target::getTitle, target::setTitle, source::getTitle);
        applyFieldChoice(choices, "displayTitle", target::getDisplayTitle, target::setDisplayTitle, source::getDisplayTitle);
        applyFieldChoice(choices, "titleKo", target::getTitleKo, target::setTitleKo, source::getTitleKo);
        applyFieldChoice(choices, "titleEn", target::getTitleEn, target::setTitleEn, source::getTitleEn);
        applyFieldChoice(choices, "titleJa", target::getTitleJa, target::setTitleJa, source::getTitleJa);
        applyFieldChoice(choices, "subtitle", target::getSubtitle, target::setSubtitle, source::getSubtitle);
        applyFieldChoice(choices, "category", target::getCategory, target::setCategory, source::getCategory);
        applyFieldChoice(choices, "placeType", target::getPlaceType, target::setPlaceType, source::getPlaceType);
        applyFieldChoice(choices, "googlePlaceId", target::getGooglePlaceId, target::setGooglePlaceId, source::getGooglePlaceId);

        // Coordinates: if choice is B, use source coords
        if ("B".equalsIgnoreCase(choices.getOrDefault("coords", "A"))) {
            target.setLat(source.getLat());
            target.setLon(source.getLon());
        }

        // Fallback enrichment for fields with no explicit choice and target is blank
        if (!choices.containsKey("googlePlaceId") && blankToNull(target.getGooglePlaceId()) == null && blankToNull(source.getGooglePlaceId()) != null) {
            target.setGooglePlaceId(source.getGooglePlaceId());
        }
        if (!choices.containsKey("subtitle") && blankToNull(target.getSubtitle()) == null && blankToNull(source.getSubtitle()) != null) {
            target.setSubtitle(source.getSubtitle());
        }
        if (!choices.containsKey("titleKo") && blankToNull(target.getTitleKo()) == null && blankToNull(source.getTitleKo()) != null) {
            target.setTitleKo(source.getTitleKo());
        }
        if (!choices.containsKey("titleEn") && blankToNull(target.getTitleEn()) == null && blankToNull(source.getTitleEn()) != null) {
            target.setTitleEn(source.getTitleEn());
        }
        if (!choices.containsKey("titleJa") && blankToNull(target.getTitleJa()) == null && blankToNull(source.getTitleJa()) != null) {
            target.setTitleJa(source.getTitleJa());
        }
        if (!choices.containsKey("category") && "place".equalsIgnoreCase(nullToBlank(target.getCategory())) && !"place".equalsIgnoreCase(nullToBlank(source.getCategory()))) {
            target.setCategory(source.getCategory());
        }
        if (!choices.containsKey("placeType") && "unknown".equalsIgnoreCase(nullToBlank(target.getPlaceType())) && !"unknown".equalsIgnoreCase(nullToBlank(source.getPlaceType()))) {
            target.setPlaceType(source.getPlaceType());
        }

        migrateSearchLearning(source, target);
        travelPlanPlaceMergeService.replacePlace(source, target);
        repository.delete(source);
        PlaceMemoryEntity saved = repository.saveAndFlush(target);
        syncMlSeed(saved);
        cacheVersion.advance();
        return toDatasetItem(saved);
    }

    /** Apply a single field choice: if "B" explicitly chosen, override target with source value; if "A", keep target as-is. */
    private void applyFieldChoice(java.util.Map<String, String> choices, String field,
            java.util.function.Supplier<String> getTarget, java.util.function.Consumer<String> setTarget,
            java.util.function.Supplier<String> getSource) {
        String choice = choices.get(field);
        if ("B".equalsIgnoreCase(choice)) {
            String srcVal = getSource.get();
            if (blankToNull(srcVal) != null) setTarget.accept(srcVal);
        }
        // "A" or absent = keep existing target value (no-op)
    }

    @Transactional
    public Map<String, Object> adminBatchMergeDuplicates() {
        List<PlaceMemoryEntity> allEntities = repository.findAll();
        java.util.Set<Long> mergedIds = new java.util.HashSet<>();
        java.util.Set<Long> changedSurvivorIds = new java.util.HashSet<>();
        int mergedCount = 0;

        for (int i = 0; i < allEntities.size(); i++) {
            PlaceMemoryEntity a = allEntities.get(i);
            if (mergedIds.contains(a.getId())) continue;

            for (int j = i + 1; j < allEntities.size(); j++) {
                PlaceMemoryEntity b = allEntities.get(j);
                if (mergedIds.contains(b.getId())) continue;

                boolean sameGoogle = !nullToBlank(a.getGooglePlaceId()).isBlank()
                        && nullToBlank(a.getGooglePlaceId()).equalsIgnoreCase(nullToBlank(b.getGooglePlaceId()));

                boolean sameSourceId = !nullToBlank(a.getSourcePlaceId()).isBlank()
                        && nullToBlank(a.getSourcePlaceId()).equalsIgnoreCase(nullToBlank(b.getSourcePlaceId()));

                String titleA = normalize(firstNonBlank(a.getTitleKo(), a.getDisplayTitle(), a.getTitle()));
                String titleB = normalize(firstNonBlank(b.getTitleKo(), b.getDisplayTitle(), b.getTitle()));
                boolean sameTitle = !titleA.isBlank() && titleA.length() >= 2 && titleA.equals(titleB);

                double distMeters = distanceMeters(a.getLat(), a.getLon(), b.getLat(), b.getLon());
                boolean closeDistance = distMeters <= 500.0;

                if (sameGoogle || sameSourceId || (sameTitle && closeDistance)) {
                    a.setSelectionCount(Math.max(1, a.getSelectionCount() + b.getSelectionCount()));
                    a.setReviewCount(a.getReviewCount() + b.getReviewCount());
                    a.setLastSelectedAt(latest(a.getLastSelectedAt(), b.getLastSelectedAt()));

                    if (blankToNull(a.getGooglePlaceId()) == null && blankToNull(b.getGooglePlaceId()) != null) {
                        a.setGooglePlaceId(b.getGooglePlaceId());
                    }
                    if (blankToNull(a.getSubtitle()) == null && blankToNull(b.getSubtitle()) != null) {
                        a.setSubtitle(b.getSubtitle());
                    }
                    if (blankToNull(a.getTitleKo()) == null && blankToNull(b.getTitleKo()) != null) {
                        a.setTitleKo(b.getTitleKo());
                    }

                    migrateSearchLearning(b, a);
                    travelPlanPlaceMergeService.replacePlace(b, a);
                    repository.delete(b);
                    mergedIds.add(b.getId());
                    changedSurvivorIds.add(a.getId());
                    mergedCount++;
                }
            }
        }
        repository.flush();
        allEntities.stream()
                .filter(entity -> changedSurvivorIds.contains(entity.getId()))
                .forEach(this::syncMlSeed);
        cacheVersion.advance();
        return Map.of("mergedCount", mergedCount, "remainingCount", allEntities.size() - mergedCount);
    }

    public record PlaceDatasetMergeRequest(long targetId, long sourceId, java.util.Map<String, String> fieldChoices) {
        public PlaceDatasetMergeRequest { if (fieldChoices == null) fieldChoices = java.util.Map.of(); }
    }

    public record PlaceDatasetDeleteResult(long id, long deletedLearningRows) {}

    /** Moves every query-level ML signal from the removed place to the surviving place. */
    private void migrateSearchLearning(PlaceMemoryEntity source, PlaceMemoryEntity target) {
        migrateSearchLearning(source.getSource(), source.getSourcePlaceId(), target);
    }

    private void migrateSearchLearning(String source, String sourcePlaceId, PlaceMemoryEntity target) {
        List<PlaceSearchLearningEntity> sourceRows = learningRepository
                .findAllBySourceAndSourcePlaceId(source, sourcePlaceId);
        for (PlaceSearchLearningEntity sourceRow : sourceRows) {
            PlaceSearchLearningEntity targetRow = learningRepository
                    .findByCountryCodeAndNormalizedQueryAndSourceAndSourcePlaceId(
                            sourceRow.getCountryCode(), sourceRow.getNormalizedQuery(),
                            target.getSource(), target.getSourcePlaceId())
                    .orElse(null);
            if (targetRow == null) {
                sourceRow.setSource(target.getSource());
                sourceRow.setSourcePlaceId(target.getSourcePlaceId());
                learningRepository.save(sourceRow);
                continue;
            }
            targetRow.setDiscoveryCount(saturatedAdd(targetRow.getDiscoveryCount(), sourceRow.getDiscoveryCount()));
            targetRow.setSelectionCount(saturatedAdd(targetRow.getSelectionCount(), sourceRow.getSelectionCount()));
            targetRow.setLastDiscoveredAt(latest(targetRow.getLastDiscoveredAt(), sourceRow.getLastDiscoveredAt()));
            targetRow.setLastSelectedAt(latest(targetRow.getLastSelectedAt(), sourceRow.getLastSelectedAt()));
            learningRepository.delete(sourceRow);
            learningRepository.save(targetRow);
        }
    }

    private int saturatedAdd(int left, int right) {
        long sum = (long) Math.max(0, left) + Math.max(0, right);
        return (int) Math.min(Integer.MAX_VALUE, sum);
    }

    private void syncMlSeed(PlaceMemoryEntity entity) {
        adminMlIngestService.syncSeedCoordinates(
                firstNonBlank(entity.getTitleKo(), entity.getDisplayTitle(), entity.getTitle()),
                entity.getLat(), entity.getLon(), nullToBlank(entity.getSource()).toLowerCase(Locale.ROOT));
    }

    public record RecentSelection(PlaceItem place, String query, String countryCode, Duration remainingTtl) {}

    @Transactional(readOnly = true)
    public List<RecentSelection> recentSelectionsForCache() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime cutoff = now.minusDays(7);
        return repository.findBySelectionCountGreaterThanAndLastSelectedAtAfterOrderByLastSelectedAtAsc(0, cutoff)
                .stream()
                .filter(entity -> !"GOOGLE".equalsIgnoreCase(entity.getSource())
                        || (entity.getSourceDataExpiresAt() != null && entity.getSourceDataExpiresAt().isAfter(now)))
                .map(entity -> new RecentSelection(
                        toPlaceItem(entity, entity.getSelectedQuery()),
                        entity.getSelectedQuery(),
                        countryFromCoordinates(entity.getLat(), entity.getLon()),
                        Duration.between(now, entity.getLastSelectedAt().plusDays(7))
                ))
                .filter(selection -> !selection.remainingTtl().isNegative() && !selection.remainingTtl().isZero())
                .toList();
    }

    private String countryFromCoordinates(double lat, double lon) {
        boolean korea = lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
        if (korea) return "KR";
        return "JP";
    }

    private PlaceMemoryEntity upsertMemory(PlaceItem place, String query, String provider, boolean selected) {
        if (place == null || !hasValidCoordinates(place.lat(), place.lon())) return null;
        if (isPhoton(place, provider)) return null;

        String source = normalizeSource(provider, place.id());
        String sourcePlaceId = normalizeSourcePlaceId(place.id(), place.lat(), place.lon());
        String title = firstNonBlank(place.title(), place.displayTitle(), place.titleKo(), place.titleEn(), place.titleJa(), sourcePlaceId);
        PlaceMemoryEntity entity = repository.findBySourceAndSourcePlaceId(source, sourcePlaceId)
                .orElseGet(() -> findDuplicateMemory(place).orElseGet(PlaceMemoryEntity::new));
        boolean existing = entity.getId() != null;
        boolean reviewed = existing && entity.getReviewCount() > 0;

        if (!existing) {
            entity.setSource(source);
            entity.setSourcePlaceId(sourcePlaceId);
            entity.setCategory(normalizeNominatimField(place.category(), "place", 80));
            entity.setPlaceType(normalizeNominatimField(place.type(), "unknown", 120));
        }
        if ("GOOGLE".equals(source)) {
            entity.setGooglePlaceId(sourcePlaceId);
            entity.setSourceDataExpiresAt(LocalDateTime.now().plusDays(30));
        }
        if (!existing) {
            entity.setTitle(limit(title, 220));
            entity.setDisplayTitle(limit(validLabel(place.displayTitle()), 320));
            entity.setTitleKo(limit(validLabel(place.titleKo()), 220));
            entity.setTitleEn(limit(blankToNull(place.titleEn()), 220));
            entity.setTitleJa(limit(blankToNull(place.titleJa()), 220));
            entity.setSubtitle(limit(blankToNull(place.subtitle()), 600));
            entity.setLat(place.lat());
            entity.setLon(place.lon());
        } else if (!reviewed) {
            entity.setCategory(normalizeNominatimField(place.category(), entity.getCategory(), 80));
            entity.setPlaceType(normalizeNominatimField(place.type(), entity.getPlaceType(), 120));
            if (blankToNull(entity.getDisplayTitle()) == null || isGenericLanguageLabel(entity.getDisplayTitle())) {
                entity.setDisplayTitle(limit(validLabel(place.displayTitle()), 320));
            }
            if (blankToNull(entity.getTitleKo()) == null) entity.setTitleKo(limit(validLabel(place.titleKo()), 220));
            if (blankToNull(entity.getTitleEn()) == null) entity.setTitleEn(limit(blankToNull(place.titleEn()), 220));
            if (blankToNull(entity.getTitleJa()) == null) entity.setTitleJa(limit(blankToNull(place.titleJa()), 220));
            if (blankToNull(entity.getSubtitle()) == null) entity.setSubtitle(limit(blankToNull(place.subtitle()), 600));
        }
        entity.setSelectedQuery(limit(mergeAliases(entity.getSelectedQuery(), query, place), 500));
        entity.setNormalizedText(limit(normalizedText(place, entity.getSelectedQuery()), NORMALIZED_TEXT_MAX_LENGTH));
        if (selected) {
            entity.setSelectionCount(Math.max(0, entity.getSelectionCount()) + 1);
            entity.setLastSelectedAt(LocalDateTime.now());
        }

        repository.save(entity);
        return entity;
    }

    private void upsertLearning(PlaceItem place, String query, String provider, String countryCode, boolean selected, PlaceMemoryEntity memory) {
        if (isPhoton(place, provider)) return;
        String normalizedQuery = limit(normalize(query), 300);
        if (place == null || normalizedQuery == null || normalizedQuery.isBlank() || memory == null) return;

        String source = memory.getSource();
        String sourcePlaceId = memory.getSourcePlaceId();
        String country = normalizeCountry(countryCode);
        PlaceSearchLearningEntity learning = learningRepository
                .findByCountryCodeAndNormalizedQueryAndSourceAndSourcePlaceId(country, normalizedQuery, source, sourcePlaceId)
                .orElseGet(PlaceSearchLearningEntity::new);
        LocalDateTime now = LocalDateTime.now();

        learning.setCountryCode(country);
        learning.setNormalizedQuery(normalizedQuery);
        learning.setCompactQuery(limit(compact(normalizedQuery), 300));
        learning.setSource(source);
        learning.setSourcePlaceId(sourcePlaceId);
        if (selected) {
            learning.setSelectionCount(Math.max(0, learning.getSelectionCount()) + 1);
            learning.setLastSelectedAt(now);
        } else {
            learning.setDiscoveryCount(Math.max(0, learning.getDiscoveryCount()) + 1);
            learning.setLastDiscoveredAt(now);
        }
        learningRepository.save(learning);
    }

    private void ensureSearchLearning(PlaceMemoryEntity memory, String query, String countryCode) {
        String normalizedQuery = limit(normalize(query), 300);
        if (memory == null || normalizedQuery == null || normalizedQuery.isBlank()) return;
        String country = normalizeCountry(countryCode);
        PlaceSearchLearningEntity learning = learningRepository
                .findByCountryCodeAndNormalizedQueryAndSourceAndSourcePlaceId(
                        country, normalizedQuery, memory.getSource(), memory.getSourcePlaceId())
                .orElseGet(PlaceSearchLearningEntity::new);
        learning.setCountryCode(country);
        learning.setNormalizedQuery(normalizedQuery);
        learning.setCompactQuery(limit(compact(normalizedQuery), 300));
        learning.setSource(memory.getSource());
        learning.setSourcePlaceId(memory.getSourcePlaceId());
        learning.setSelectionCount(Math.max(Math.max(1, memory.getSelectionCount()), learning.getSelectionCount()));
        learning.setLastSelectedAt(latest(learning.getLastSelectedAt(), memory.getLastSelectedAt()));
        learningRepository.save(learning);
    }

    private boolean isPhoton(PlaceItem place, String provider) {
        if (provider != null && provider.trim().equalsIgnoreCase("photon")) return true;
        return place != null && place.id() != null
                && place.id().trim().toLowerCase(Locale.ROOT).startsWith("photon:");
    }

    private java.util.Optional<PlaceMemoryEntity> findDuplicateMemory(PlaceItem place) {
        double latitudeWindow = 0.001;
        double longitudeWindow = 0.0015;
        Set<String> incomingNames = identityNames(place.title(), place.displayTitle(), place.titleKo(), place.titleEn(), place.titleJa());
        return repository.findNearby(place.lat() - latitudeWindow, place.lat() + latitudeWindow,
                        place.lon() - longitudeWindow, place.lon() + longitudeWindow).stream()
                .filter(candidate -> {
                    double distance = distanceMeters(place.lat(), place.lon(), candidate.getLat(), candidate.getLon());
                    // The database coordinate key is unique at 6 decimal places. Reuse the
                    // existing row before an insert can violate that constraint.
                    if (distance <= 0.2) return true;
                    // Different providers frequently pin the same venue at its entrance,
                    // building centre, or road frontage. Requiring a 10 m match created a
                    // second managed row when a user selected that provider's result later.
                    // Names must still match exactly: a building and a tenant can legitimately
                    // share coordinates (for example Sunshine City and a restaurant inside it).
                    if (distance > 100 || incomingNames.isEmpty()) return false;
                    Set<String> candidateNames = identityNames(candidate.getTitle(), candidate.getDisplayTitle(),
                            candidate.getTitleKo(), candidate.getTitleEn(), candidate.getTitleJa());
                    return candidateNames.stream().anyMatch(incomingNames::contains);
                })
                .max(Comparator.comparingInt(PlaceMemoryEntity::getReviewCount)
                        .thenComparingInt(PlaceMemoryEntity::getSelectionCount)
                        .thenComparing(entity -> -entity.getId()));
    }

    private Set<String> identityNames(String... values) {
        Set<String> names = new LinkedHashSet<>();
        for (String value : values) {
            if (isGenericLanguageLabel(value)) continue;
            String identity = compact(value);
            if (identity.length() >= 2) names.add(identity);
        }
        return names;
    }

    private String mergeAliases(String existing, String query, PlaceItem place) {
        Map<String, String> aliases = new LinkedHashMap<>();
        Set<String> referenceNames = identityNames(
                place.title(), place.displayTitle(), place.titleKo(), place.titleEn(), place.titleJa());
        addAliasVariants(aliases, place.titleKo());
        addAliasVariants(aliases, place.titleJa());
        addAliasVariants(aliases, place.titleEn());
        addAliasVariants(aliases, place.title());
        addAliasVariants(aliases, place.displayTitle());
        addRelatedAliases(aliases, existing, referenceNames);
        addRelatedAliases(aliases, query, referenceNames);
        return aliases.isEmpty() ? null : String.join(" | ", aliases.values());
    }

    private void addAliasVariants(Map<String, String> aliases, String value) {
        QueryVariantBuilder.build(value).forEach(variant -> addAlias(aliases, variant));
    }

    private String rebuildAdminAliases(String manuallyEditedAliases, PlaceItem place) {
        Map<String, String> aliases = new LinkedHashMap<>();
        addAliasVariants(aliases, place.titleKo());
        addAliasVariants(aliases, place.titleJa());
        addAliasVariants(aliases, place.titleEn());
        addAliasVariants(aliases, place.title());
        addAliasVariants(aliases, place.displayTitle());
        if (manuallyEditedAliases != null && !manuallyEditedAliases.isBlank()) {
            for (String alias : manuallyEditedAliases.split("[|#;,]+")) {
                addAlias(aliases, alias);
            }
        }
        return aliases.isEmpty() ? null : String.join(" | ", aliases.values());
    }

    private void addRelatedAliases(Map<String, String> aliases, String value, Set<String> referenceNames) {
        if (value == null || value.isBlank() || referenceNames.isEmpty()) return;
        for (String alias : value.split("[|#;,]+")) {
            String key = compact(alias);
            if (isRelatedAlias(key, referenceNames)) addAlias(aliases, alias);
        }
    }

    private boolean isRelatedAlias(String aliasKey, Set<String> referenceNames) {
        if (aliasKey.length() < 2) return false;
        for (String reference : referenceNames) {
            if (aliasKey.equals(reference)) return true;
            int shorter = Math.min(aliasKey.length(), reference.length());
            int longer = Math.max(aliasKey.length(), reference.length());
            if (shorter >= 4 && (aliasKey.contains(reference) || reference.contains(aliasKey))
                    && (double) shorter / longer >= 0.5) return true;
        }
        return false;
    }

    private void addAlias(Map<String, String> aliases, String value) {
        String alias = nullToBlank(value).trim().replaceAll("\\s+", " ");
        if (alias.isBlank() || alias.length() > 120 || isGenericLanguageLabel(alias)) return;
        String key = normalize(alias);
        if (!key.isBlank()) aliases.putIfAbsent(key, alias);
    }

    private String validLabel(String value) {
        String label = blankToNull(value);
        return label == null || isGenericLanguageLabel(label) ? null : label;
    }

    private boolean isGenericLanguageLabel(String value) {
        String key = compact(value);
        return key.equals("한국어") || key.equals("일본어") || key.equals("영어")
                || key.equals("korean") || key.equals("japanese") || key.equals("english")
                || key.startsWith("한국어(") || key.startsWith("일본어(") || key.startsWith("영어(");
    }

    private double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double latRadians = Math.toRadians((lat1 + lat2) / 2.0);
        double north = (lat1 - lat2) * 111_320.0;
        double east = (lon1 - lon2) * 111_320.0 * Math.cos(latRadians);
        return Math.hypot(north, east);
    }

    private LocalDateTime latest(LocalDateTime first, LocalDateTime second) {
        if (first == null) return second;
        if (second == null) return first;
        return first.isAfter(second) ? first : second;
    }

    private PlaceItem toPlaceItem(PlaceMemoryEntity entity, String query) {
        String titleKo = KoreanPlaceNameResolver.resolveTitle(
                entity.getTitleKo(), query, entity.getTitle(), entity.getTitleEn(), entity.getTitleJa(), entity.getSubtitle()
        );
        String title = titleKo == null || titleKo.isBlank() ? entity.getTitle() : titleKo;
        // 관리자 데이터셋에서 지정한 표시 이름은 검색어/별칭에 따라 바뀌면 안 된다.
        // 별칭은 매칭에만 사용하고, 결과 라벨은 저장된 displayTitle을 우선한다.
        String displayTitle = firstNonBlank(entity.getDisplayTitle(), titleKo, entity.getTitle());
        String provider = "CUSTOM".equalsIgnoreCase(entity.getSource()) || (entity.getGooglePlaceId() != null && !entity.getGooglePlaceId().isBlank() && !"GOOGLE".equalsIgnoreCase(entity.getSource()))
                ? "custom"
                : entity.getSource().toLowerCase(Locale.ROOT);
        return new PlaceItem(
                entity.getSource() + ":" + entity.getSourcePlaceId(),
                title,
                displayTitle,
                titleKo,
                entity.getTitleEn(),
                entity.getTitleJa(),
                KoreanPlaceNameResolver.localizeSubtitle(entity.getSubtitle()),
                entity.getLat(),
                entity.getLon(),
                Math.log1p(Math.max(0, entity.getSelectionCount())),
                entity.getSelectedQuery(),
                entity.getCategory(),
                entity.getPlaceType(),
                provider
        );
    }

    private String normalizedText(PlaceItem place, String aliases) {
        String googleFullPhrase = googleFullPhrase(place);
        Set<String> phrases = new LinkedHashSet<>();
        addLearningPhrase(phrases, aliases);
        addLearningPhrase(phrases, googleFullPhrase);
        addLearningPhrase(phrases, place.title());
        addLearningPhrase(phrases, place.displayTitle());
        addLearningPhrase(phrases, place.titleKo());
        addLearningPhrase(phrases, place.titleEn());
        addLearningPhrase(phrases, place.titleJa());
        addLearningPhrase(phrases, place.subtitle());
        return normalize(String.join(" ", phrases));
    }

    private void addLearningPhrase(Set<String> phrases, String value) {
        String normalized = normalize(value);
        if (normalized.isBlank()) return;
        phrases.add(normalized);
        String compacted = compact(normalized);
        if (!compacted.isBlank()) phrases.add(compacted);
    }

    private String googleFullPhrase(PlaceItem place) {
        return String.join(" ",
                nullToBlank(place.displayTitle()),
                nullToBlank(place.title()),
                nullToBlank(place.titleKo()),
                nullToBlank(place.titleEn()),
                nullToBlank(place.titleJa()),
                nullToBlank(place.subtitle())
        ).trim().replaceAll("\\s+", " ");
    }

    private String compact(String value) {
        return normalize(value).replace(" ", "");
    }

    private String normalizeSource(String provider, String placeId) {
        String value = placeId == null || placeId.isBlank() ? provider : placeId;
        if (value == null) return "MANUAL";
        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.startsWith("custom")) return "CUSTOM";
        if (lower.startsWith("google")) return "GOOGLE";
        if (lower.startsWith("place") || lower.startsWith("nominatim")) return "NOMINATIM";
        if (lower.startsWith("photon")) return "PHOTON";
        if (lower.startsWith("manual")) return "MANUAL";
        if (provider != null && provider.equalsIgnoreCase("google")) return "GOOGLE";
        if (provider != null && provider.equalsIgnoreCase("local")) return "LOCAL";
        return "MANUAL";
    }

    private String normalizeSourcePlaceId(String placeId, double lat, double lon) {
        if (placeId != null && !placeId.isBlank()) {
            int index = placeId.indexOf(':');
            String normalized = limit(index >= 0 ? placeId.substring(index + 1) : placeId, 180);
            if (normalized != null && !normalized.isBlank()) return normalized;
        }
        return String.format(Locale.ROOT, "%.6f,%.6f", lat, lon);
    }

    private boolean hasValidCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private String normalize(String value) {
        return PlaceRankingModel.normalize(value);
    }

    private String normalizeCountry(String countryCode) {
        if (countryCode == null) return "KR";
        return switch (countryCode.trim().toUpperCase(Locale.ROOT)) {
            case "JP", "JPN", "JA" -> "JP";
            case "KR", "KOR", "KO" -> "KR";
            default -> "KR";
        };
    }

    private String normalizeNominatimField(String value, String fallback, int maxLength) {
        String normalized = blankToNull(value);
        if (normalized == null) normalized = blankToNull(fallback);
        if (normalized == null) return "unknown";
        return limit(normalized.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_'), maxLength);
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
