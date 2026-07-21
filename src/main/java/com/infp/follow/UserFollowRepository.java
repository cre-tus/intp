package com.infp.follow;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserFollowRepository extends JpaRepository<UserFollowEntity, Long> {
    long countByFollowing_Id(Long userId);

    long countByFollower_Id(Long userId);

    boolean existsByFollower_IdAndFollowing_Id(Long followerId, Long followingId);

    void deleteByFollower_IdAndFollowing_Id(Long followerId, Long followingId);

    List<UserFollowEntity> findAllByFollowing_IdOrderByCreatedAtDesc(Long userId);

    List<UserFollowEntity> findAllByFollower_IdOrderByCreatedAtDesc(Long userId);
}
