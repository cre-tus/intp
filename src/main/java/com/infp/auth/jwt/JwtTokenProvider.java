package com.infp.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    // ✅ 예시: access 1시간, refresh 30일
    private static final long ACCESS_EXP_MS  = 1000L * 60 * 60;
    private static final long REFRESH_EXP_MS = 1000L * 60 * 60 * 24 * 30;

    public String createAccessToken(Long userId, String email) {
        return buildToken(userId, email, "ACCESS", ACCESS_EXP_MS);
    }

    public String createRefreshToken(Long userId, String email) {
        return buildToken(userId, email, "REFRESH", REFRESH_EXP_MS);
    }

    private String buildToken(Long userId, String email, String typ, long expMs) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expMs);

        return Jwts.builder()
                .claim("userId", userId)  // JWT PAYLOAD에 사용자 식별자 저장
                .claim("email", email)    //      ""       사용자 이메일 저장
                .claim("typ", typ)        // 토큰 ACCESS/REFRESH 구분
                .setIssuedAt(now)            // 토큰 발급일
                .setExpiration(exp)          // 토큰 만료일

                // 토큰 서명(Signature)
                // 1) secret 키
                // 2) HS256(HMAC-SHA256) 알고리즘
                .signWith(
                        Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256
                )
                .compact();
    }

    // refresh 검증/파싱에 필요
    public Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
