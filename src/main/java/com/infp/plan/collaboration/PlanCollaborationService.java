package com.infp.plan.collaboration;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class PlanCollaborationService {

    private final JdbcTemplate jdbcTemplate;

    public PlanCollaborationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<PlanParticipantDto> participants(long planId, long requesterId) {
        requireMember(planId, requesterId);
        return jdbcTemplate.query("""
                        SELECT u.id, u.email, COALESCE(u.nickname, CONCAT(u.first_name, ' ', u.last_name)) AS nickname,
                               pm.role, pm.status
                        FROM plan_members pm
                        JOIN users u ON u.id = pm.user_id
                        WHERE pm.plan_id = ?
                        ORDER BY FIELD(pm.role, 'OWNER', 'EDITOR', 'VIEWER'), pm.joined_at
                        """,
                (rs, rowNum) -> new PlanParticipantDto(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("nickname"),
                        rs.getString("role"),
                        rs.getString("status")
                ),
                planId
        );
    }

    @Transactional
    public PlanParticipantDto addParticipant(long planId, long requesterId, AddPlanParticipantRequest request) {
        requireCanEditMembers(planId, requesterId);
        String email = request.email() == null ? "" : request.email().trim();
        if (email.isBlank()) {
            throw new IllegalArgumentException("추가할 참여자 이메일을 입력해주세요.");
        }

        Long userId = findUserIdByEmail(email);
        String role = normalizeRole(request.role(), "EDITOR");
        if ("OWNER".equals(role)) {
            throw new IllegalArgumentException("소유자 권한은 참여자 추가로 부여할 수 없습니다.");
        }

        jdbcTemplate.update("""
                        INSERT INTO plan_members (plan_id, user_id, role, status)
                        VALUES (?, ?, ?, 'ACTIVE')
                        ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'ACTIVE'
                        """,
                planId, userId, role
        );

        return participant(planId, userId);
    }

    @Transactional
    public PlanParticipantDto updateRole(long planId, long userId, long requesterId, UpdatePlanParticipantRoleRequest request) {
        requireCanEditMembers(planId, requesterId);
        String role = normalizeRole(request.role(), "VIEWER");
        if ("OWNER".equals(role)) {
            throw new IllegalArgumentException("소유자 권한은 이 API로 변경할 수 없습니다.");
        }
        if (isOwner(planId, userId)) {
            throw new IllegalArgumentException("플랜 소유자의 권한은 변경할 수 없습니다.");
        }

        int updated = jdbcTemplate.update(
                "UPDATE plan_members SET role = ? WHERE plan_id = ? AND user_id = ?",
                role, planId, userId
        );
        if (updated == 0) {
            throw new IllegalArgumentException("해당 참여자를 찾을 수 없습니다.");
        }
        return participant(planId, userId);
    }

    @Transactional
    public void removeParticipant(long planId, long userId, long requesterId) {
        requireCanEditMembers(planId, requesterId);
        if (isOwner(planId, userId)) {
            throw new IllegalArgumentException("플랜 소유자는 제거할 수 없습니다.");
        }
        jdbcTemplate.update("DELETE FROM plan_members WHERE plan_id = ? AND user_id = ?", planId, userId);
    }

    private PlanParticipantDto participant(long planId, long userId) {
        return jdbcTemplate.queryForObject("""
                        SELECT u.id, u.email, COALESCE(u.nickname, CONCAT(u.first_name, ' ', u.last_name)) AS nickname,
                               pm.role, pm.status
                        FROM plan_members pm
                        JOIN users u ON u.id = pm.user_id
                        WHERE pm.plan_id = ? AND pm.user_id = ?
                        """,
                (rs, rowNum) -> new PlanParticipantDto(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("nickname"),
                        rs.getString("role"),
                        rs.getString("status")
                ),
                planId,
                userId
        );
    }

    private void requireMember(long planId, long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_members WHERE plan_id = ? AND user_id = ? AND status = 'ACTIVE'",
                Integer.class,
                planId,
                userId
        );
        if (count == null || count == 0) {
            throw new IllegalArgumentException("플랜 참여자만 접근할 수 있습니다.");
        }
    }

    private void requireCanEditMembers(long planId, long userId) {
        String role = roleOf(planId, userId);
        if (!"OWNER".equals(role) && !"EDITOR".equals(role)) {
            throw new IllegalArgumentException("참여자 관리 권한이 없습니다.");
        }
    }

    private String roleOf(long planId, long userId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT role FROM plan_members WHERE plan_id = ? AND user_id = ? AND status = 'ACTIVE'",
                    String.class,
                    planId,
                    userId
            );
        } catch (EmptyResultDataAccessException exception) {
            throw new IllegalArgumentException("플랜 참여자만 접근할 수 있습니다.");
        }
    }

    private boolean isOwner(long planId, long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_members WHERE plan_id = ? AND user_id = ? AND role = 'OWNER'",
                Integer.class,
                planId,
                userId
        );
        return count != null && count > 0;
    }

    private Long findUserIdByEmail(String email) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM users WHERE email = ? AND status = 'ACTIVE'",
                    Long.class,
                    email
            );
        } catch (EmptyResultDataAccessException exception) {
            throw new IllegalArgumentException("해당 이메일의 활성 사용자를 찾을 수 없습니다.");
        }
    }

    private static String normalizeRole(String value, String fallback) {
        String role = value == null || value.isBlank()
                ? fallback
                : value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("OWNER", "EDITOR", "VIEWER").contains(role)) {
            throw new IllegalArgumentException("역할은 OWNER, EDITOR, VIEWER 중 하나여야 합니다.");
        }
        return role;
    }
}
