package com.infp.admin.dto;

public record ServerTestJobStatusResponse(
        String jobId,
        String status,
        int completedUsers,
        int totalUsers,
        int progressPercent,
        ServerTestResponse result,
        String error
) {
}
