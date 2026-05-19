package com.infp.admin.dto;

import java.util.List;

public record ServerTestShuffleResponse(
        int nodeCount,
        int userCount,
        List<ServerTestUserNodes> users
) {
}
