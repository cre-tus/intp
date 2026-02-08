package com.infp.user.entity;

import jakarta.persistence.*;
// JPA 관련 어노테이션 묶음
// @Entity, @Id, @Column, @GeneratedValue
// "DB 연결" 선언할 때 사용

import lombok.Getter;
// getter 메서드를 자동으로 만들어진다
// getId(), getEmail() 같은 거 직접 안 써도 됨

import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
// 기본 생성자 자동 생성
// JPA는 기본 생성자 필수

@Entity
@Table(name = "users")
@Setter
@Getter
@NoArgsConstructor
public class User {
    @Id // PRIMARY KEY
    @GeneratedValue(strategy = GenerationType.IDENTITY) // id 값을 MySQL이 자동으로 증가시켜줌 (IDENTITY = AUTO_INCREMENT)
    private Long id;

    @Column(nullable = false, unique = true)
    // NOT NULL + UNIQUE
    private String email;

    @Column(name = "password_hash", nullable = false)
    // 컬럼명 password_hash (DB 표기법), 필드명 passwordHash (자바 카멜표기법)
    private String passwordHash;

    @Column(name = "first_name", nullable = false)
    // 컬럼명 first_name (DB 표기법), 필드명 firstName (자바 카멜표기법)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    // 컬럼명 last_name (DB 표기법), 필드명 lastName (자바 카멜표기법) 공백 불가
    private String lastName;

    private String nickname;

    private LocalDate birth;
    //Date <-> LocalDate

    @Enumerated(EnumType.STRING)
    //Enum('ACTIVE', 'SUSPENDED', 'DELETED')
    private UserStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    // 생성 시각, 이후 수정 불가
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    // 수정 시각
    private LocalDateTime updatedAt;

    @Column(name = "refresh_token_hash")
    //리프레시 토큰 (해시화)
    private String refreshTokenHash;

    @Column(name = "refresh_token_expires_at")
    //리프레시 토큰 만료기간
    private LocalDateTime refreshTokenExpiresAt;

    @PrePersist //insert, update 시 자동갱신
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.status = UserStatus.ACTIVE;
    }

    @PreUpdate //insert, update 시 자동갱신
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

