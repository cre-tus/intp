package com.infp.travel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TravelPlanRepository extends JpaRepository<TravelPlanEntity, Long> {
    Optional<TravelPlanEntity> findByExternalId(String externalId);

    List<TravelPlanEntity> findAllByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    @Query(value = """
            SELECT p.*
            FROM plans p
            JOIN plan_members pm ON pm.plan_id = p.id
            WHERE pm.user_id = :userId
              AND pm.status = 'ACTIVE'
              AND p.owner_id <> :userId
            ORDER BY p.updated_at DESC
            """, nativeQuery = true)
    List<TravelPlanEntity> findSharedPlansByUserId(@Param("userId") Long userId);
}
