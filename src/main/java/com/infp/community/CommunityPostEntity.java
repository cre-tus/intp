package com.infp.community;

import com.infp.travel.TravelPlanEntity;
import com.infp.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "community_posts")
@Getter
@Setter
@NoArgsConstructor
public class CommunityPostEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", columnDefinition = "BIGINT UNSIGNED")
    private TravelPlanEntity plan;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 80)
    private String city;

    @Column(nullable = false, length = 40)
    private String duration;

    @Column(nullable = false, length = 40)
    private String budget;

    @Column(name = "image_key", nullable = false, length = 40)
    private String imageKey = "tokyo";

    @Lob
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String caption;

    @Lob
    @Column(name = "tags_json", columnDefinition = "TEXT")
    private String tagsJson;

    @Lob
    @Column(name = "route_json", columnDefinition = "TEXT")
    private String routeJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (imageKey == null || imageKey.isBlank()) imageKey = "tokyo";
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
