package com.infp.admin.dto;

import java.util.List;

public record ServerTestRequest(
        int nodeCount,
        int userCount,
        String shuffleJobId,
        List<ServerTestUserNodes> users
) {
}
