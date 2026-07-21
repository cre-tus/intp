package com.infp.community;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityPostCommentRepository extends JpaRepository<CommunityPostCommentEntity, Long> {
    long countByPost_Id(Long postId);

    List<CommunityPostCommentEntity> findTop30ByPost_IdOrderByCreatedAtAsc(Long postId);
}
