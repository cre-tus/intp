package com.infp.travel;

import com.infp.travel.dto.TravelPlanRequest;
import com.infp.travel.dto.TravelPlanResponse;
import com.infp.travel.dto.TravelPlanSummaryResponse;
import com.infp.user.entity.User;
import com.infp.user.repository.UserRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public class TravelPlanService {
    private final TravelPlanRepository repository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TravelPlanService(TravelPlanRepository repository, UserRepository userRepository, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<TravelPlanSummaryResponse> list(long userId) {
        cleanupOwnedPlansWithoutActiveMembers(userId);
        return repository.findAllByOwnerIdOrderByUpdatedAtDesc(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    public List<TravelPlanSummaryResponse> listShared(long userId) {
        return repository.findSharedPlansByUserId(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    public TravelPlanResponse get(String externalId, long userId) {
        TravelPlanEntity entity = requirePlan(externalId);
        requireCanView(entity, userId);
        return toResponse(entity);
    }

    @Transactional
    public TravelPlanResponse save(long userId, TravelPlanRequest request) {
        String externalId = requireText(request.id(), "계획 ID가 필요합니다.");
        JsonNode content = request.content() == null ? objectMapper.createObjectNode() : request.content();
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        TravelPlanEntity entity = repository.findByExternalId(externalId).orElseGet(TravelPlanEntity::new);
        if (entity.getId() == null) {
            entity.setExternalId(externalId);
            entity.setOwner(owner);
        } else {
            requireCanEdit(entity, owner);
        }

        entity.setTitle(requireText(request.title(), "제목이 필요합니다."));
        entity.setTemplate(blankToDefault(request.template(), "basic"));
        entity.setTier(blankToDefault(request.tier(), "FREE"));
        entity.setContentJson(toJson(content));
        entity.setStartDate(firstDate(content));
        entity.setEndDate(lastDate(content, entity.getStartDate()));

        TravelPlanEntity saved = repository.saveAndFlush(entity);
        ensureOwnerMember(saved, userId);
        syncPlanMembers(saved, content);
        syncSpreadsheetCells(saved, content);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String externalId, long userId) {
        TravelPlanEntity entity = requirePlan(externalId);
        requireOwner(entity, userId);
        deletePlanRows(entity.getId(), externalId);
    }

    private void cleanupOwnedPlansWithoutActiveMembers(long userId) {
        List<TravelPlanEntity> orphanPlans = repository.findAllByOwnerIdOrderByUpdatedAtDesc(userId).stream()
                .filter(plan -> participantCount(plan) == 0)
                .toList();

        for (TravelPlanEntity plan : orphanPlans) {
            deletePlanRows(plan.getId(), plan.getExternalId());
        }
    }

    private void deletePlanRows(Long planId, String externalId) {
        if (planId == null) return;
        jdbcTemplate.update("DELETE FROM payment_requests WHERE plan_id = ?", externalId);
        jdbcTemplate.update("DELETE FROM plan_spreadsheet_cells WHERE plan_id = ?", planId);
        jdbcTemplate.update("""
                        DELETE FROM plan_items
                        WHERE plan_day_id IN (
                            SELECT id FROM plan_days WHERE plan_id = ?
                        )
                        """,
                planId
        );
        jdbcTemplate.update("DELETE FROM plan_days WHERE plan_id = ?", planId);
        jdbcTemplate.update("DELETE FROM plan_checklist_items WHERE plan_id = ?", planId);
        jdbcTemplate.update("DELETE FROM plan_members WHERE plan_id = ?", planId);
        jdbcTemplate.update("DELETE FROM plans WHERE id = ?", planId);
    }

    @Transactional
    public void updateTier(String externalId, String tier) {
        repository.findByExternalId(externalId).ifPresent(entity -> {
            entity.setTier(blankToDefault(tier, "FREE"));
            try {
                JsonNode content = parseJson(entity.getContentJson());
                if (content instanceof ObjectNode objectNode) {
                    objectNode.put("tier", entity.getTier());
                    entity.setContentJson(objectMapper.writeValueAsString(objectNode));
                }
            } catch (Exception ignored) {
                // tier column is authoritative when content patching fails.
            }
        });
    }

    public void requirePaidOwnerPlan(String externalId, long userId) {
        TravelPlanEntity entity = requirePlan(externalId);
        requireOwner(entity, userId);
        if (!"PAID".equals(entity.getTier())) {
            throw new IllegalArgumentException("유료 템플릿에서만 Google 장소 검색을 사용할 수 있습니다.");
        }
    }

    private TravelPlanEntity requirePlan(String externalId) {
        return repository.findByExternalId(externalId)
                .orElseThrow(() -> new IllegalArgumentException("여행 계획을 찾을 수 없습니다."));
    }

    private void requireOwner(TravelPlanEntity entity, long userId) {
        if (entity.getOwner() == null || !entity.getOwner().getId().equals(userId)) {
            throw new IllegalArgumentException("여행 계획 접근 권한이 없습니다.");
        }
    }

    private void requireCanView(TravelPlanEntity entity, long userId) {
        if (isOwner(entity, userId) || activePlanMemberRole(entity, userId) != null) return;

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        if (contentRoleForEmail(entity, user.getEmail()) != null) return;

        throw new IllegalArgumentException("여행 계획 접근 권한이 없습니다.");
    }

    private void requireCanEdit(TravelPlanEntity entity, User user) {
        if (isOwner(entity, user.getId())) return;

        String memberRole = activePlanMemberRole(entity, user.getId());
        if ("EDITOR".equals(memberRole)) return;

        String contentRole = contentRoleForEmail(entity, user.getEmail());
        if ("OWNER".equals(contentRole) || "EDITOR".equals(contentRole)) return;

        throw new IllegalArgumentException("여행 계획 수정 권한이 없습니다.");
    }

    private boolean isOwner(TravelPlanEntity entity, long userId) {
        return entity.getOwner() != null && entity.getOwner().getId().equals(userId);
    }

    private String activePlanMemberRole(TravelPlanEntity entity, long userId) {
        if (entity.getId() == null) return null;
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT role FROM plan_members WHERE plan_id = ? AND user_id = ? AND status = 'ACTIVE'",
                    String.class,
                    entity.getId(),
                    userId
            );
        } catch (EmptyResultDataAccessException exception) {
            return null;
        }
    }

    private String contentRoleForEmail(TravelPlanEntity entity, String email) {
        if (email == null || email.isBlank()) return null;
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        JsonNode participants = parseJson(entity.getContentJson()).get("participants");
        if (participants == null || !participants.isArray()) return null;

        for (JsonNode participant : participants) {
            String participantEmail = text(participant, "email").trim().toLowerCase(Locale.ROOT);
            if (normalizedEmail.equals(participantEmail)) {
                return normalizeRole(text(participant, "role"), "EDITOR");
            }
        }
        return null;
    }

    private void ensureOwnerMember(TravelPlanEntity entity, long userId) {
        jdbcTemplate.update("""
                        INSERT INTO plan_members (plan_id, user_id, role, status)
                        VALUES (?, ?, 'OWNER', 'ACTIVE')
                        ON DUPLICATE KEY UPDATE role = 'OWNER', status = 'ACTIVE'
                        """,
                entity.getId(),
                userId
        );
    }

    private void syncPlanMembers(TravelPlanEntity entity, JsonNode content) {
        JsonNode participants = content.get("participants");
        if (participants == null || !participants.isArray()) return;

        Set<Long> activeParticipantIds = new HashSet<>();
        for (JsonNode participant : participants) {
            String email = text(participant, "email").trim().toLowerCase(Locale.ROOT);
            if (email.isBlank()) continue;

            userRepository.findByEmail(email).ifPresent(user -> {
                activeParticipantIds.add(user.getId());
                if (isOwner(entity, user.getId())) return;
                String role = normalizeRole(text(participant, "role"), "EDITOR");
                if ("OWNER".equals(role)) role = "EDITOR";
                jdbcTemplate.update("""
                                INSERT INTO plan_members (plan_id, user_id, role, status)
                                VALUES (?, ?, ?, 'ACTIVE')
                                ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'ACTIVE'
                                """,
                        entity.getId(),
                        user.getId(),
                        role
                );
            });
        }

        List<Long> currentMemberIds = jdbcTemplate.queryForList(
                "SELECT user_id FROM plan_members WHERE plan_id = ? AND role <> 'OWNER'",
                Long.class,
                entity.getId()
        );
        for (Long memberId : currentMemberIds) {
            if (!activeParticipantIds.contains(memberId)) {
                jdbcTemplate.update(
                        "DELETE FROM plan_members WHERE plan_id = ? AND user_id = ? AND role <> 'OWNER'",
                        entity.getId(),
                        memberId
                );
            }
        }
    }

    private void syncSpreadsheetCells(TravelPlanEntity entity, JsonNode content) {
        jdbcTemplate.update("DELETE FROM plan_spreadsheet_cells WHERE plan_id = ?", entity.getId());
        if (!"spreadsheet".equals(entity.getTemplate())) return;

        JsonNode days = content.get("days");
        if (days == null || !days.isArray()) return;

        for (int dayIndex = 0; dayIndex < days.size(); dayIndex += 1) {
            JsonNode day = days.get(dayIndex);
            JsonNode activities = day.get("activities");
            if (activities == null || !activities.isArray()) continue;

            for (int rowIndex = 0; rowIndex < activities.size(); rowIndex += 1) {
                JsonNode activity = activities.get(rowIndex);
                String rowKey = text(activity, "time");
                if (rowKey.isBlank()) continue;
                String value = firstText(activity, "activity", "location");
                Integer cost = intValue(activity, "cost");
                jdbcTemplate.update("""
                                INSERT INTO plan_spreadsheet_cells (
                                    plan_id, external_day_id, external_activity_id, day_number, row_order,
                                    row_key, row_label, cell_value, cost, place_id, place_subtitle,
                                    latitude, longitude, route_role, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                                """,
                        entity.getId(),
                        text(day, "id"),
                        text(activity, "id"),
                        dayIndex + 1,
                        rowIndex + 1,
                        rowKey,
                        rowLabel(rowKey),
                        value,
                        cost,
                        text(activity, "placeId"),
                        text(activity, "placeSubtitle"),
                        doubleValue(activity, "lat"),
                        doubleValue(activity, "lon"),
                        blankToDefault(text(activity, "routeRole"), "NONE")
                );
            }
        }
    }

    private TravelPlanResponse toResponse(TravelPlanEntity entity) {
        return new TravelPlanResponse(
                entity.getExternalId(),
                entity.getTitle(),
                entity.getTemplate(),
                entity.getTier(),
                parseJson(entity.getContentJson()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private TravelPlanSummaryResponse toSummary(TravelPlanEntity entity) {
        return new TravelPlanSummaryResponse(
                entity.getExternalId(),
                entity.getTitle(),
                entity.getTemplate(),
                entity.getTier(),
                participantCount(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private int participantCount(TravelPlanEntity entity) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_members WHERE plan_id = ? AND status = 'ACTIVE'",
                Integer.class,
                entity.getId()
        );
        return count == null ? 0 : count;
    }

    private JsonNode parseJson(String value) {
        try {
            if (value == null || value.isBlank()) return objectMapper.createObjectNode();
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String toJson(JsonNode content) {
        try {
            return objectMapper.writeValueAsString(content == null ? objectMapper.createObjectNode() : content);
        } catch (Exception exception) {
            throw new IllegalArgumentException("여행 계획 JSON 저장에 실패했습니다.");
        }
    }

    private static LocalDate firstDate(JsonNode content) {
        JsonNode days = content == null ? null : content.get("days");
        if (days != null && days.isArray()) {
            for (JsonNode day : days) {
                LocalDate parsed = parseDate(text(day, "date"));
                if (parsed != null) return parsed;
            }
        }
        return LocalDate.now();
    }

    private static LocalDate lastDate(JsonNode content, LocalDate fallback) {
        LocalDate latest = fallback == null ? LocalDate.now() : fallback;
        JsonNode days = content == null ? null : content.get("days");
        if (days != null && days.isArray()) {
            for (JsonNode day : days) {
                LocalDate parsed = parseDate(text(day, "date"));
                if (parsed != null && parsed.isAfter(latest)) latest = parsed;
            }
        }
        return latest;
    }

    private static LocalDate parseDate(String value) {
        try {
            return value == null || value.isBlank() ? null : LocalDate.parse(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String rowLabel(String rowKey) {
        if ("__lodging__".equals(rowKey)) return "숙소 위치";
        if (rowKey.startsWith("__cost__:")) return rowKey.substring("__cost__:".length());
        if (rowKey.startsWith("__custom__:")) {
            String[] parts = rowKey.split(":", 3);
            return parts.length == 3 && !parts[2].isBlank() ? parts[2] : "추가 행";
        }
        return rowKey;
    }

    private static String firstText(JsonNode node, String first, String second) {
        String firstValue = text(node, first);
        return firstValue.isBlank() ? text(node, second) : firstValue;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private static Integer intValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? 0 : value.asInt(0);
    }

    private static Double doubleValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() || !value.isNumber() ? null : value.asDouble();
    }

    private static String requireText(String value, String message) {
        if (value == null || value.trim().isBlank()) throw new IllegalArgumentException(message);
        return value.trim();
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.trim().isBlank() ? fallback : value.trim();
    }

    private static String normalizeRole(String value, String fallback) {
        String role = value == null || value.isBlank()
                ? fallback
                : value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("OWNER", "EDITOR", "VIEWER").contains(role)) return fallback;
        return role;
    }
}
