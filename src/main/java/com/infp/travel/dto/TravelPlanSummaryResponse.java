package com.infp.travel.dto;

import java.time.LocalDateTime;

public record TravelPlanSummaryResponse(
        String id,
        String title,
        String template,
        String tier,
        int participantCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
