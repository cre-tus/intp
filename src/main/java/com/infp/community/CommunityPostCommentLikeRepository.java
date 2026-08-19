package com.infp.community;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityPostCommentLikeRepository extends JpaRepository<CommunityPostCommentLikeEntity, Long> {
    long countByComment_Id(Long commentId);

    boolean existsByComment_IdAndUser_Id(Long commentId, Long userId);

    void deleteByComment_IdAndUser_Id(Long commentId, Long userId);
}
