package com.infp.follow;

import com.infp.follow.dto.FollowStatsResponse;
import com.infp.follow.dto.FollowStatusResponse;
import com.infp.follow.dto.FollowUserResponse;
import com.infp.user.entity.User;
import com.infp.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserFollowService {
    private final UserFollowRepository followRepository;
    private final UserRepository userRepository;

    public UserFollowService(UserFollowRepository followRepository, UserRepository userRepository) {
        this.followRepository = followRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public FollowStatsResponse stats(long userId) {
        requireUser(userId);
        return new FollowStatsResponse(
                userId,
                followRepository.countByFollowing_Id(userId),
                followRepository.countByFollower_Id(userId)
        );
    }

    @Transactional(readOnly = true)
    public FollowStatusResponse status(long viewerId, long targetUserId) {
        requireUser(targetUserId);
        return response(viewerId, targetUserId);
    }

    @Transactional(readOnly = true)
    public List<FollowUserResponse> followers(long viewerId) {
        requireUser(viewerId);
        return followRepository.findAllByFollowing_IdOrderByCreatedAtDesc(viewerId).stream()
                .map(UserFollowEntity::getFollower)
                .map((user) -> toUserResponse(viewerId, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FollowUserResponse> following(long viewerId) {
        requireUser(viewerId);
        return followRepository.findAllByFollower_IdOrderByCreatedAtDesc(viewerId).stream()
                .map(UserFollowEntity::getFollowing)
                .map((user) -> toUserResponse(viewerId, user))
                .toList();
    }

    @Transactional
    public FollowStatusResponse toggle(long followerId, long targetUserId) {
        if (followerId == targetUserId) {
            throw new IllegalArgumentException("자기 자신은 팔로우할 수 없습니다.");
        }

        User follower = requireUser(followerId);
        User following = requireUser(targetUserId);

        if (followRepository.existsByFollower_IdAndFollowing_Id(followerId, targetUserId)) {
            followRepository.deleteByFollower_IdAndFollowing_Id(followerId, targetUserId);
            return response(followerId, targetUserId);
        }

        UserFollowEntity follow = new UserFollowEntity();
        follow.setFollower(follower);
        follow.setFollowing(following);
        followRepository.save(follow);
        return response(followerId, targetUserId);
    }

    private FollowStatusResponse response(long viewerId, long targetUserId) {
        return new FollowStatusResponse(
                targetUserId,
                followRepository.existsByFollower_IdAndFollowing_Id(viewerId, targetUserId),
                followRepository.countByFollowing_Id(targetUserId),
                followRepository.countByFollower_Id(targetUserId)
        );
    }

    private FollowUserResponse toUserResponse(long viewerId, User user) {
        String name = displayName(user);
        return new FollowUserResponse(
                user.getId(),
                name,
                "@" + user.getEmail().split("@")[0],
                avatar(user, name),
                !user.getId().equals(viewerId) && followRepository.existsByFollower_IdAndFollowing_Id(viewerId, user.getId())
        );
    }

    private String displayName(User user) {
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName())
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
        if (user.getNickname() != null && !user.getNickname().isBlank()) return user.getNickname().trim();
        if (!fullName.isBlank()) return fullName;
        return user.getEmail();
    }

    private String initials(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isBlank()) return "U";
        return trimmed.length() <= 2 ? trimmed.toUpperCase() : trimmed.substring(0, 2).toUpperCase();
    }

    private String avatar(User user, String name) {
        if (user.getProfileImageUrl() != null && !user.getProfileImageUrl().isBlank()) {
            return user.getProfileImageUrl();
        }
        return initials(name);
    }

    private User requireUser(long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }
}
