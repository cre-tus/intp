package com.infp.place.repository;

import com.infp.place.entity.PlaceMemoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface PlaceMemoryRepository extends JpaRepository<PlaceMemoryEntity, Long> {
    Optional<PlaceMemoryEntity> findBySourceAndSourcePlaceId(String source, String sourcePlaceId);

    List<PlaceMemoryEntity> findBySelectionCountGreaterThanAndLastSelectedAtAfterOrderByLastSelectedAtAsc(
            int selectionCount,
            LocalDateTime selectedAfter
    );

    @Query("""
            SELECT pm FROM PlaceMemoryEntity pm
            WHERE pm.lat BETWEEN :minLat AND :maxLat
              AND pm.lon BETWEEN :minLon AND :maxLon
            """)
    List<PlaceMemoryEntity> findNearby(
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("minLon") double minLon,
            @Param("maxLon") double maxLon
    );

    @Query(value = """
            SELECT *
            FROM place_memory pm
            WHERE pm.selection_count > 0
              AND pm.review_count >= 1
              AND UPPER(pm.source) IN ('NOMINATIM', 'LOCAL', 'MANUAL', 'CUSTOM')
              AND (
                  EXISTS (
                    SELECT 1
                    FROM place_search_learning country_learning
                    WHERE country_learning.source = pm.source
                      AND country_learning.source_place_id = pm.source_place_id
                      AND country_learning.country_code = :countryCode
                  )
                  OR (:countryCode = 'JP' AND pm.lat BETWEEN 24 AND 46 AND pm.lon BETWEEN 122 AND 146
                      AND NOT (pm.lat BETWEEN 33 AND 39 AND pm.lon BETWEEN 124 AND 129.1))
                  OR (:countryCode = 'KR' AND pm.lat BETWEEN 33 AND 39 AND pm.lon BETWEEN 124 AND 132)
               )
              AND (
                   pm.normalized_text LIKE CONCAT('%', :query, '%')
                   OR pm.selected_query LIKE CONCAT('%', :query, '%')
                   OR REPLACE(pm.normalized_text, ' ', '') LIKE CONCAT('%', :compactQuery, '%')
                   OR REPLACE(COALESCE(pm.selected_query, ''), ' ', '') LIKE CONCAT('%', :compactQuery, '%')
                   OR EXISTS (
                    SELECT 1
                    FROM place_search_learning psl
                    WHERE psl.source = pm.source
                      AND psl.source_place_id = pm.source_place_id
                      AND psl.country_code = :countryCode
                      AND (
                          psl.normalized_query LIKE CONCAT('%', :query, '%')
                          OR psl.compact_query LIKE CONCAT('%', :compactQuery, '%')
                      )
                   )
              )
            ORDER BY pm.selection_count DESC, pm.last_selected_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<PlaceMemoryEntity> searchMemory(
            @Param("query") String query,
            @Param("compactQuery") String compactQuery,
            @Param("countryCode") String countryCode,
            @Param("limit") int limit
    );

    @Query(value = """
            SELECT *
            FROM place_memory pm
            WHERE pm.selection_count > 0
              AND pm.review_count >= 1
              AND UPPER(pm.source) IN ('NOMINATIM', 'LOCAL', 'MANUAL', 'CUSTOM')
              AND (
                  EXISTS (
                    SELECT 1
                    FROM place_search_learning country_learning
                    WHERE country_learning.source = pm.source
                      AND country_learning.source_place_id = pm.source_place_id
                      AND country_learning.country_code = :countryCode
                  )
                  OR (:countryCode = 'JP' AND pm.lat BETWEEN 24 AND 46 AND pm.lon BETWEEN 122 AND 146
                      AND NOT (pm.lat BETWEEN 33 AND 39 AND pm.lon BETWEEN 124 AND 129.1))
                  OR (:countryCode = 'KR' AND pm.lat BETWEEN 33 AND 39 AND pm.lon BETWEEN 124 AND 132)
               )
              AND (
                   REPLACE(pm.normalized_text, ' ', '') LIKE CONCAT('%', :prefix, '%')
                   OR REPLACE(COALESCE(pm.selected_query, ''), ' ', '') LIKE CONCAT('%', :prefix, '%')
                   OR EXISTS (
                    SELECT 1
                    FROM place_search_learning psl
                    WHERE psl.source = pm.source
                      AND psl.source_place_id = pm.source_place_id
                      AND psl.country_code = :countryCode
                      AND psl.compact_query LIKE CONCAT('%', :prefix, '%')
                   )
              )
            ORDER BY pm.selection_count DESC, pm.last_selected_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<PlaceMemoryEntity> searchFuzzyCandidates(
            @Param("prefix") String prefix,
            @Param("countryCode") String countryCode,
            @Param("limit") int limit
    );
}
