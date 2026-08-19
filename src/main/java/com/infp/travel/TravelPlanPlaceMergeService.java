package com.infp.travel;

import com.infp.place.entity.PlaceMemoryEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Service
public class TravelPlanPlaceMergeService {
    private final TravelPlanRepository planRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public TravelPlanPlaceMergeService(TravelPlanRepository planRepository, JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper) {
        this.planRepository = planRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /** Re-points durable user-plan references before the duplicate place is removed. */
    public void replacePlace(PlaceMemoryEntity removed, PlaceMemoryEntity survivor) {
        replacePlace(removed.getSource(), removed.getSourcePlaceId(), survivor);
    }

    public void replacePlace(String removedSource, String removedSourcePlaceId, PlaceMemoryEntity survivor) {
        Set<String> removedIds = placeIdAliases(removedSource, removedSourcePlaceId);
        String survivorId = survivor.getSource() + ":" + survivor.getSourcePlaceId();
        String subtitle = survivor.getSubtitle();

        for (TravelPlanEntity plan : planRepository.findAll()) {
            if (plan.getContentJson() == null || plan.getContentJson().isBlank()) continue;
            try {
                JsonNode content = objectMapper.readTree(plan.getContentJson());
                boolean changed = replaceActivities(content, removedIds, survivorId, subtitle,
                        survivor.getLat(), survivor.getLon());
                if (changed) {
                    plan.setContentJson(objectMapper.writeValueAsString(content));
                    planRepository.save(plan);
                }
            } catch (Exception exception) {
                throw new IllegalStateException("사용자 여행 계획의 병합 장소 참조를 갱신하지 못했습니다: plan="
                        + plan.getExternalId(), exception);
            }
        }

        for (String removedId : removedIds) {
            jdbcTemplate.update("""
                    UPDATE plan_spreadsheet_cells
                    SET place_id = ?, place_subtitle = ?, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP(6)
                    WHERE LOWER(place_id) = LOWER(?)
                    """, survivorId, subtitle, survivor.getLat(), survivor.getLon(), removedId);
        }
    }

    private boolean replaceActivities(JsonNode content, Set<String> removedIds, String survivorId,
            String subtitle, double lat, double lon) {
        JsonNode days = content == null ? null : content.get("days");
        if (days == null || !days.isArray()) return false;
        boolean changed = false;
        for (JsonNode day : days) {
            JsonNode activities = day.get("activities");
            if (activities == null || !activities.isArray()) continue;
            for (JsonNode activity : activities) {
                if (!(activity instanceof ObjectNode object)) continue;
                JsonNode placeId = object.get("placeId");
                if (placeId == null || !placeId.isTextual() || !containsIgnoreCase(removedIds, placeId.asText())) continue;
                object.put("placeId", survivorId);
                if (subtitle == null || subtitle.isBlank()) object.remove("placeSubtitle");
                else object.put("placeSubtitle", subtitle);
                object.put("lat", lat);
                object.put("lon", lon);
                changed = true;
            }
        }
        return changed;
    }

    private Set<String> placeIdAliases(String source, String sourceId) {
        Set<String> ids = new LinkedHashSet<>();
        ids.add(source + ":" + sourceId);
        ids.add(source.toLowerCase(Locale.ROOT) + ":" + sourceId);
        if ("NOMINATIM".equalsIgnoreCase(source) || "CUSTOM".equalsIgnoreCase(source)) ids.add("place:" + sourceId);
        if ("GOOGLE".equalsIgnoreCase(source)) ids.add("google:" + sourceId);
        return ids;
    }

    private boolean containsIgnoreCase(Set<String> values, String candidate) {
        return values.stream().anyMatch(value -> value.equalsIgnoreCase(candidate));
    }
}
