package com.infp.community.dto;

public record CommunityPostReactionResponse(
        Long postId,
        boolean active,
        long count
) {
}
