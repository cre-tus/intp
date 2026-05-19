package com.infp.admin.dto;

import java.util.List;

public record ServerTestUserNodes(
        int userIndex,
        List<ServerTestPoint> points
) {
}
