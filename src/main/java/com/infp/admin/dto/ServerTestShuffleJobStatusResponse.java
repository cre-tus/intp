package com.infp.admin.dto;

public record ServerTestShuffleJobStatusResponse(
        String jobId,
        String status,
        int completedUsers,
        int totalUsers,
        int progressPercent,
        ServerTestShuffleResponse result,
        String error
) {
}
