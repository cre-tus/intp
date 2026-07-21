package com.infp.community.dto;

import java.time.LocalDateTime;

public record CommunityPostCommentResponse(
        long id,
        long postId,
        long authorId,
        String author,
        String avatar,
        String content,
        boolean ownComment,
        boolean edited,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
