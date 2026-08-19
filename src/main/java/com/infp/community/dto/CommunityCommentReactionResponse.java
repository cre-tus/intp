package com.infp.community.dto;

public record CommunityCommentReactionResponse(
        long commentId,
        boolean active,
        long count
) {
}
