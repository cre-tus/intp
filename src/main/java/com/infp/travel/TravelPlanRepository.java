package com.infp.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TravelPlanRepository extends JpaRepository<TravelPlanEntity, Long> {
    Optional<TravelPlanEntity> findByExternalId(String externalId);

    List<TravelPlanEntity> findAllByOwnerIdOrderByUpdatedAtDesc(Long ownerId);
}
