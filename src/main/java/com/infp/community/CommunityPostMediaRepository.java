package com.infp.community;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityPostMediaRepository extends JpaRepository<CommunityPostMediaEntity, Long> {
    List<CommunityPostMediaEntity> findByPost_IdOrderBySortOrderAscIdAsc(Long postId);

    void deleteByPost_Id(Long postId);
}
