package com.infp.community.dto;

import java.util.List;

public record CommunityUserProfileResponse(
        long userId,
        String nickname,
        String handle,
        String avatar,
        String statusMessage,
        long followers,
        long following,
        long posts,
        long sharedPlans,
        boolean followingUser,
        boolean ownProfile,
        List<CommunityPostResponse> feed
) {
}
