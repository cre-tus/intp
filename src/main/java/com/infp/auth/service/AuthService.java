package com.infp.auth.service;

import com.infp.auth.dto.LoginRequest;
import com.infp.auth.jwt.JwtTokenProvider;
import com.infp.user.entity.User;
import com.infp.user.entity.UserStatus;
import com.infp.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    //  access + refresh 둘 다 반환
    public TokenPair login(LoginRequest req) {

        // Step 1) 이메일로 사용자 조회
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new RuntimeException("이메일 못찾음 Login failed"));

        // Step 2) 상태 체크
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new RuntimeException("상태 불량 Login failed");
        }

        // Step 3) 비밀번호 검증 (여긴 BCrypt 그대로 써도 됨)
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new RuntimeException("비밀번호 검증 오류 Login failed");
        }

        // Step 4) 토큰 2개 발급
        String accessToken  = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId(), user.getEmail());

        //  Step 5) refresh는 DB에 "SHA-256 해시"로 저장 + 만료 저장
        // (BCrypt encode(refreshToken) 금지: JWT 길이 때문에 72 bytes 제한 터짐)
        user.setRefreshTokenHash(sha256Hex(refreshToken));
        user.setRefreshTokenExpiresAt(LocalDateTime.now().plusDays(30));
        userRepository.save(user);

        return new TokenPair(accessToken, refreshToken);
    }

    //  refreshToken으로 access 재발급 + refresh 회전(rotate)
    public TokenPair refresh(String refreshToken) {

        Claims claims = jwtTokenProvider.parseClaims(refreshToken);

        // Step 1) 토큰 용도 확인 (ACCESS로 refresh 치는거 방지)
        String typ = claims.get("typ", String.class);
        if (!"REFRESH".equals(typ)) {
            throw new RuntimeException("Invalid refresh");
        }

        // Step 2) userId 추출
        Long userId = ((Number) claims.get("userId")).longValue();

        // Step 3) 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Invalid refresh"));

        // Step 4) DB에 저장된 refresh 만료 체크
        if (user.getRefreshTokenExpiresAt() == null
                || user.getRefreshTokenExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Invalid refresh");
        }

        //  Step 5) DB에 저장된 refresh "SHA-256 해시"와 비교
        String hashed = sha256Hex(refreshToken);
        if (user.getRefreshTokenHash() == null
                || !hashed.equals(user.getRefreshTokenHash())) {
            throw new RuntimeException("Invalid refresh");
        }

        // Step 6) 새 access + 새 refresh 발급 (회전)
        String newAccess  = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());
        String newRefresh = jwtTokenProvider.createRefreshToken(user.getId(), user.getEmail());

        //  Step 7) DB refresh 갱신도 SHA-256 해시로 저장
        user.setRefreshTokenHash(sha256Hex(newRefresh));
        user.setRefreshTokenExpiresAt(LocalDateTime.now().plusDays(30));
        userRepository.save(user);

        return new TokenPair(newAccess, newRefresh);
    }

    public record TokenPair(String accessToken, String refreshToken) {}

    public void logoutByRefreshToken(String refreshToken) {

        Claims claims = jwtTokenProvider.parseClaims(refreshToken);

        String typ = claims.get("typ", String.class);
        if (!"REFRESH".equals(typ)) {
            return;
        }

        Long userId = ((Number) claims.get("userId")).longValue();

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        user.setRefreshTokenHash(null);
        user.setRefreshTokenExpiresAt(null);
        userRepository.save(user);
    }

    // refreshToken 저장/비교용 SHA-256
    private String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
