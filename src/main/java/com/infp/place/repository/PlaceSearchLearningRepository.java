package com.infp.place.repository;

import com.infp.place.entity.PlaceSearchLearningEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface PlaceSearchLearningRepository extends JpaRepository<PlaceSearchLearningEntity, Long> {
    Optional<PlaceSearchLearningEntity> findByCountryCodeAndNormalizedQueryAndSourceAndSourcePlaceId(
            String countryCode,
            String normalizedQuery,
            String source,
            String sourcePlaceId
    );

    long deleteBySourceAndSourcePlaceId(String source, String sourcePlaceId);

    List<PlaceSearchLearningEntity> findAllBySourceAndSourcePlaceId(String source, String sourcePlaceId);
}
