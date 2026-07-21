package com.infp.community.dto;

import java.util.List;

public record CommunityPostRequest(
        String planId,
        String title,
        String city,
        String duration,
        String budget,
        String imageKey,
        String imageUrl,
        String caption,
        List<String> tags,
        List<String> route
) {
}
