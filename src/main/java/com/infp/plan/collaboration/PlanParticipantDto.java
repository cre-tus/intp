package com.infp.plan.collaboration;

public record PlanParticipantDto(
        long userId,
        String email,
        String nickname,
        String role,
        String status
) {
}
