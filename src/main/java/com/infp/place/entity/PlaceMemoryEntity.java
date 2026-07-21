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
        name = "place_memory",
        uniqueConstraints = @UniqueConstraint(name = "uk_place_memory_source_place", columnNames = {"source", "source_place_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class PlaceMemoryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source", nullable = false, length = 30)
    private String source;

    @Column(name = "source_place_id", nullable = false, length = 180)
    private String sourcePlaceId;

    @Column(nullable = false, length = 220)
    private String title;

    @Column(name = "display_title", length = 320)
    private String displayTitle;

    @Column(name = "title_ko", length = 220)
    private String titleKo;

    @Column(name = "title_en", length = 220)
    private String titleEn;

    @Column(name = "title_ja", length = 220)
    private String titleJa;

    @Column(length = 600)
    private String subtitle;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lon;

    @Column(name = "normalized_text", nullable = false, length = 1200)
    private String normalizedText;

    @Column(name = "selected_query", length = 500)
    private String selectedQuery;

    @Column(name = "selection_count", nullable = false)
    private int selectionCount;

    @Column(name = "last_selected_at")
    private LocalDateTime lastSelectedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (lastSelectedAt == null) lastSelectedAt = now;
        if (selectionCount <= 0) selectionCount = 1;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
