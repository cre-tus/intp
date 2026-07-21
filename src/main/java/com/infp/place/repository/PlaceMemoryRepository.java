package com.infp.place.repository;

import com.infp.place.entity.PlaceMemoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlaceMemoryRepository extends JpaRepository<PlaceMemoryEntity, Long> {
    Optional<PlaceMemoryEntity> findBySourceAndSourcePlaceId(String source, String sourcePlaceId);

    @Query(value = """
            SELECT *
            FROM place_memory
            WHERE normalized_text LIKE CONCAT('%', :query, '%')
               OR selected_query LIKE CONCAT('%', :query, '%')
            ORDER BY selection_count DESC, last_selected_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<PlaceMemoryEntity> searchMemory(@Param("query") String query, @Param("limit") int limit);
}
