package com.infp.travel;

import com.infp.user.entity.User;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
public class MlTrainingPlanSnapshotService {
    private static final int MIN_COMPLETED_DAYS = 1;
    private static final int MIN_COMPLETED_PLACES = 5;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MlTrainingPlanSnapshotService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void captureIfEligible(TravelPlanEntity plan) {
        if (plan == null || plan.getExternalId() == null || plan.getContentJson() == null) return;

        JsonNode content = parseJson(plan.getContentJson());
        PlanQuality quality = qualityOf(content);
        if (!quality.eligible()) {
            return;
        }

        ObjectNode snapshot = sanitizedSnapshot(content, plan.getTitle(), plan.getStartDate(), plan.getEndDate());
        upsertSnapshot(
                plan.getExternalId(),
                ageBucket(plan.getOwner()),
                plan.getStartDate(),
                plan.getEndDate(),
                quality.completedDays(),
                quality.placeCount(),
                snapshot,
                plan.getUpdatedAt()
        );
    }

    @EventListener(ApplicationReadyEvent.class)
    public void backfillExistingEligiblePlans() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT p.external_id,
                       p.title,
                       p.start_date,
                       p.end_date,
                       p.content_json,
                       p.updated_at,
                       u.birth
                  FROM plans p
                  JOIN users u ON u.id = p.owner_id
                 WHERE p.content_json IS NOT NULL
                """);
        for (Map<String, Object> row : rows) {
            String externalId = stringValue(row.get("external_id"));
            String contentJson = stringValue(row.get("content_json"));
            if (externalId.isBlank() || contentJson.isBlank()) continue;

            JsonNode content = parseJson(contentJson);
            PlanQuality quality = qualityOf(content);
            if (!quality.eligible()) continue;

            LocalDate startDate = localDateValue(row.get("start_date"));
            LocalDate endDate = localDateValue(row.get("end_date"));
            ObjectNode snapshot = sanitizedSnapshot(content, stringValue(row.get("title")), startDate, endDate);
            upsertSnapshot(
                    externalId,
                    ageBucket(localDateValue(row.get("birth"))),
                    startDate,
                    endDate,
                    quality.completedDays(),
                    quality.placeCount(),
                    snapshot,
                    localDateTimeValue(row.get("updated_at"))
            );
        }
    }

    private void upsertSnapshot(
            String externalId,
            String ownerAgeBucket,
            LocalDate startDate,
            LocalDate endDate,
            int completedDays,
            int placeCount,
            JsonNode snapshot,
            LocalDateTime sourceUpdatedAt
    ) {
        jdbcTemplate.update("""
                        INSERT INTO ml_training_plan_snapshots (
                            plan_external_id_hash, owner_age_bucket, start_date, end_date,
                            completed_days, place_count, content_json, source_updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            owner_age_bucket = VALUES(owner_age_bucket),
                            start_date = VALUES(start_date),
                            end_date = VALUES(end_date),
                            completed_days = VALUES(completed_days),
                            place_count = VALUES(place_count),
                            content_json = VALUES(content_json),
                            source_updated_at = VALUES(source_updated_at),
                            updated_at = CURRENT_TIMESTAMP(6)
                        """,
                sha256(externalId),
                ownerAgeBucket,
                startDate,
                endDate,
                completedDays,
                placeCount,
                toJson(snapshot),
                sourceUpdatedAt
        );
    }

    private ObjectNode sanitizedSnapshot(JsonNode content, String title, LocalDate startDate, LocalDate endDate) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("title", text(content, "title").isBlank() ? title : text(content, "title"));
        root.put("startDate", startDate == null ? "" : startDate.toString());
        root.put("endDate", endDate == null ? "" : endDate.toString());

        JsonNode tripContext = content.get("tripContext");
        if (tripContext != null && tripContext.isObject()) {
            root.set("tripContext", tripContext);
        }

        ArrayNode days = objectMapper.createArrayNode();
        JsonNode sourceDays = content.get("days");
        if (sourceDays != null && sourceDays.isArray()) {
            for (JsonNode sourceDay : sourceDays) {
                ObjectNode day = objectMapper.createObjectNode();
                day.put("date", text(sourceDay, "date"));
                day.put("dayTitle", text(sourceDay, "dayTitle"));

                ArrayNode activities = objectMapper.createArrayNode();
                JsonNode sourceActivities = sourceDay.get("activities");
                if (sourceActivities != null && sourceActivities.isArray()) {
                    for (JsonNode sourceActivity : sourceActivities) {
                        if (!isValidTrainingActivity(sourceActivity)) continue;

                        ObjectNode activity = objectMapper.createObjectNode();
                        activity.put("time", text(sourceActivity, "time"));
                        activity.put("location", firstNonBlank(text(sourceActivity, "location"), text(sourceActivity, "activity")));
                        activity.put("activity", text(sourceActivity, "activity"));
                        activity.put("placeId", text(sourceActivity, "placeId"));
                        activity.put("lat", nullableDouble(sourceActivity, "lat"));
                        activity.put("lon", nullableDouble(sourceActivity, "lon"));
                        activity.put("cost", Math.max(0, intValue(sourceActivity, "cost")));
                        activities.add(activity);
                    }
                }

                day.set("activities", activities);
                days.add(day);
            }
        }
        root.set("days", days);
        return root;
    }

    private PlanQuality qualityOf(JsonNode content) {
        int completedDays = 0;
        int placeCount = 0;
        JsonNode days = content.get("days");
        if (days != null && days.isArray()) {
            for (JsonNode day : days) {
                int dayPlaces = 0;
                JsonNode activities = day.get("activities");
                if (activities != null && activities.isArray()) {
                    for (JsonNode activity : activities) {
                        if (isValidTrainingActivity(activity)) {
                            dayPlaces += 1;
                            placeCount += 1;
                        }
                    }
                }
                if (dayPlaces > 0) {
                    completedDays += 1;
                }
            }
        }
        boolean eligible = (completedDays >= 1 && placeCount >= 5) || (completedDays >= 2 && placeCount >= 8);
        return new PlanQuality(completedDays, placeCount, eligible);
    }

    private boolean isValidTrainingActivity(JsonNode activity) {
        String time = text(activity, "time");
        if (time.startsWith("__")) return false;
        String location = text(activity, "location");
        String activityText = text(activity, "activity");
        return !firstNonBlank(location, activityText).isBlank();
    }

    private JsonNode parseJson(String value) {
        try {
            return value == null || value.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(value);
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String toJson(JsonNode content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception exception) {
            throw new IllegalArgumentException("ML 학습 스냅샷 JSON 저장에 실패했습니다.");
        }
    }

    private static String ageBucket(User owner) {
        if (owner == null || owner.getBirth() == null) return "unknown";
        return ageBucket(owner.getBirth());
    }

    private static String ageBucket(LocalDate birth) {
        if (birth == null) return "unknown";
        int age = Period.between(birth, LocalDate.now()).getYears();
        if (age < 10) return "unknown";
        if (age >= 60) return "60s_plus";
        return (age / 10 * 10) + "s";
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 해시를 사용할 수 없습니다.", exception);
        }
    }

    private static String firstNonBlank(String first, String second) {
        return first == null || first.isBlank() ? second == null ? "" : second : first;
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static LocalDate localDateValue(Object value) {
        if (value instanceof LocalDate localDate) return localDate;
        if (value instanceof java.sql.Date sqlDate) return sqlDate.toLocalDate();
        if (value instanceof String text && !text.isBlank()) return LocalDate.parse(text.substring(0, 10));
        return null;
    }

    private static LocalDateTime localDateTimeValue(Object value) {
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        if (value instanceof String text && !text.isBlank()) return LocalDateTime.parse(text.replace(" ", "T"));
        return null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private static Integer intValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? 0 : value.asInt(0);
    }

    private static Double nullableDouble(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() || !value.isNumber() ? null : value.asDouble();
    }

    private record PlanQuality(int completedDays, int placeCount, boolean eligible) {
    }
}
