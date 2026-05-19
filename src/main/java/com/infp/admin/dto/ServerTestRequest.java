package com.infp.admin.dto;

import java.util.List;

public record ServerTestRequest(
        int nodeCount,
        int userCount,
        List<ServerTestUserNodes> users
) {
}
