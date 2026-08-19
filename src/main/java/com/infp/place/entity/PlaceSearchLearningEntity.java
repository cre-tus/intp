package com.infp.place.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "place_search_learning",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_place_search_learning_query_place",
                columnNames = {"country_code", "normalized_query", "source", "source_place_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class PlaceSearchLearningEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode;

    @Column(name = "normalized_query", nullable = false, length = 300)
    private String normalizedQuery;

    @Column(name = "compact_query", nullable = false, length = 300)
    private String compactQuery;

    @Column(name = "source", nullable = false, length = 30)
    private String source;

    @Column(name = "source_place_id", nullable = false, length = 180)
    private String sourcePlaceId;

    @Column(name = "discovery_count", nullable = false)
    private int discoveryCount;

    @Column(name = "selection_count", nullable = false)
    private int selectionCount;

    @Column(name = "last_discovered_at")
    private LocalDateTime lastDiscoveredAt;

    @Column(name = "last_selected_at")
    private LocalDateTime lastSelectedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
