package com.infp.community;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityPostRepository extends JpaRepository<CommunityPostEntity, Long> {
    long countByAuthor_Id(Long authorId);

    List<CommunityPostEntity> findTop50ByOrderByCreatedAtDesc();

    List<CommunityPostEntity> findAllByAuthor_IdOrderByCreatedAtDesc(Long authorId);

    List<CommunityPostEntity> findTop50ByCityContainingIgnoreCaseOrderByCreatedAtDesc(String city);

    @Query("""
            select distinct post.city
            from CommunityPostEntity post
            where :keyword = ''
               or lower(post.city) like lower(concat('%', :keyword, '%'))
            order by post.city
            """)
    List<String> findDistinctCities(@Param("keyword") String keyword);

    @Query("""
            select post
            from CommunityPostEntity post
            where lower(post.title) like lower(concat('%', :keyword, '%'))
               or post.caption like concat('%', :keyword, '%')
               or lower(post.city) like lower(concat('%', :keyword, '%'))
            order by post.createdAt desc
            """)
    List<CommunityPostEntity> searchTop50(@Param("keyword") String keyword);

    @Query("""
            select post
            from CommunityPostEntity post
            where post.author.id in (
                select follow.following.id
                from UserFollowEntity follow
                where follow.follower.id = :userId
            )
            order by post.createdAt desc
            """)
    List<CommunityPostEntity> findFollowingPosts(@Param("userId") Long userId);
}
