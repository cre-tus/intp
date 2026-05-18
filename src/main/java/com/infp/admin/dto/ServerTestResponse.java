package com.infp.admin.dto;

import java.util.List;

public record ServerTestResponse(
        int nodeCount,
        int userCount,
        long wallClockMillis,
        double averageWithoutRedisMillis,
        double averageWithRedisMillis,
        int successCount,
        int failureCount,
        List<ServerTestPoint> points,
        List<ServerTestUserResult> results
) {
}
