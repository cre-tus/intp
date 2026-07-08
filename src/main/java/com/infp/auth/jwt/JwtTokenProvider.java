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

    private static final long ACCESS_EXP_MS = 1000L * 60 * 60;
    private static final long REFRESH_EXP_MS = 1000L * 60 * 60 * 24 * 30;

    public String createAccessToken(Long userId, String email) {
        return buildToken(userId, email, "ACCESS", ACCESS_EXP_MS, false);
    }

    public String createRefreshToken(Long userId, String email) {
        return createRefreshToken(userId, email, false);
    }

    public String createRefreshToken(Long userId, String email, boolean rememberMe) {
        return buildToken(userId, email, "REFRESH", REFRESH_EXP_MS, rememberMe);
    }

    private String buildToken(Long userId, String email, String typ, long expMs, boolean rememberMe) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expMs);

        return Jwts.builder()
                .claim("userId", userId)
                .claim("email", email)
                .claim("typ", typ)
                .claim("rememberMe", rememberMe)
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(
                        Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256
                )
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
