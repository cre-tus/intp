package com.infp.community.dto;

import java.time.LocalDateTime;

public record CommunityPlanViewResponse(
        Long postId,
        String planId,
        String postTitle,
        String author,
        String title,
        String template,
        String tier,
        String contentJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
