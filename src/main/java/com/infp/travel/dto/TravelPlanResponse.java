package com.infp.travel.dto;

import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;

public record TravelPlanResponse(
        String id,
        String title,
        String template,
        String tier,
        JsonNode content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
