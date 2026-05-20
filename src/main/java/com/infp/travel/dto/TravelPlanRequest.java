package com.infp.travel.dto;

import tools.jackson.databind.JsonNode;

public record TravelPlanRequest(
        String id,
        String title,
        String template,
        String tier,
        JsonNode content
) {
}
