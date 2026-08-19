package com.infp.admin;

import com.infp.travel.TravelPlanService;
import com.infp.travel.dto.TravelPlanRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Map;

@Service
public class AdminMlIngestPlanService {
    private final TravelPlanService travelPlanService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AdminMlIngestPlanService(TravelPlanService travelPlanService) {
        this.travelPlanService = travelPlanService;
    }

    public String saveApprovedBasicPlan(Map<String, Object> job, long userId) {
        Map<String, Object> review = map(job.get("review"));
        Map<String, Object> preview = map(review.get("plan_preview"));
        if (preview.isEmpty()) return "";

        String sourceHash = text(map(review.get("source")).get("sha256"));
        String suffix = sourceHash.length() >= 12 ? sourceHash.substring(0, 12) : Integer.toHexString(preview.hashCode());
        String planId = "image-plan-" + suffix + "-" + userId;
        String title = text(preview.get("title"));
        if (title.isBlank()) title = "이미지에서 가져온 여행 일정";

        JsonNode tree = objectMapper.valueToTree(preview);
        if (!(tree instanceof ObjectNode content)) return "";
        content.put("id", planId);
        content.put("title", title);
        content.put("template", "basic");
        content.put("tier", "FREE");

        travelPlanService.save(userId, new TravelPlanRequest(planId, title, "basic", "FREE", content));
        return planId;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
