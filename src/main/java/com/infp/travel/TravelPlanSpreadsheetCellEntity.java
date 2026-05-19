package com.infp.travel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
        name = "plan_spreadsheet_cells",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_plan_spreadsheet_cell",
                columnNames = {"plan_id", "external_day_id", "row_key"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class TravelPlanSpreadsheetCellEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private TravelPlanEntity plan;

    @Column(name = "external_day_id", length = 100)
    private String externalDayId;

    @Column(name = "external_activity_id", length = 100)
    private String externalActivityId;

    @Column(name = "day_number", nullable = false)
    private Integer dayNumber;

    @Column(name = "row_order", nullable = false)
    private Integer rowOrder;

    @Column(name = "row_key", nullable = false, length = 160)
    private String rowKey;

    @Column(name = "row_label", nullable = false, length = 120)
    private String rowLabel;

    @Column(name = "cell_value", columnDefinition = "TEXT")
    private String cellValue;

    @Column(nullable = false)
    private Integer cost = 0;

    @Column(name = "place_id", length = 128)
    private String placeId;

    @Column(name = "place_subtitle", length = 400)
    private String placeSubtitle;

    @Column(precision = 10, scale = 7)
    private Double latitude;

    @Column(precision = 10, scale = 7)
    private Double longitude;

    @Column(name = "route_role", nullable = false, length = 20)
    private String routeRole = "NONE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (cost == null) cost = 0;
        if (routeRole == null || routeRole.isBlank()) routeRole = "NONE";
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
