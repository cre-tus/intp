package com.infp.community.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CommunityPostResponse(
        Long id,
        String postType,
        String planId,
        Long authorId,
        String author,
        String handle,
        String avatar,
        String title,
        String city,
        String duration,
        String budget,
        String imageKey,
        String imageUrl,
        String mediaType,
        String mediaUrl,
        String caption,
        String questionDetail,
        String attempted,
        String answerPreference,
        List<String> tags,
        List<String> route,
        long likes,
        long comments,
        long saves,
        boolean liked,
        boolean saved,
        boolean followingAuthor,
        boolean ownPost,
        LocalDateTime createdAt
) {
}
