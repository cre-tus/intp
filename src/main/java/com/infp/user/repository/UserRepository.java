package com.infp.user.repository;

import com.infp.user.entity.User;

import org.springframework.data.jpa.repository.JpaRepository;
//기본 CRUD 메서드 제공하는 인터페이스

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // User : 엔티티
    // Long : User의 PK(id) 타입

    Optional<User> findByEmail(String email);
    // email로 사용자 조회
    // 내부적으로 SQL 자동 생성
    // SELECT * FROM users WHERE email = ?;

    boolean existsByEmail(String email);
    // 해당 email이 이미 존재하는지 확인
    // 회원가입 시 중복 체크용으로 사용
        
}
