package com.infp.community;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityPostSaveRepository extends JpaRepository<CommunityPostSaveEntity, Long> {
    long countByPost_Id(Long postId);

    boolean existsByPost_IdAndUser_Id(Long postId, Long userId);

    void deleteByPost_IdAndUser_Id(Long postId, Long userId);

    List<CommunityPostSaveEntity> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
}
