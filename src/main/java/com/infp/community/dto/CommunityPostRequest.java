package com.infp.community.dto;

import java.util.List;

public record CommunityPostRequest(
        String postType,
        String planId,
        String title,
        String city,
        String duration,
        String budget,
        String imageKey,
        String imageUrl,
        String mediaType,
        String mediaUrl,
        String mediaOriginalFilename,
        String mediaMimeType,
        Long mediaSizeBytes,
        Integer mediaDurationSeconds,
        String caption,
        String questionDetail,
        String attempted,
        String answerPreference,
        List<String> tags,
        List<String> route
) {
}
