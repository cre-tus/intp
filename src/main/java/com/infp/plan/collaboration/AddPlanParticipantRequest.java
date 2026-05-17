package com.infp.plan.collaboration;

public record AddPlanParticipantRequest(
        String email,
        String role
) {
}
