package com.infp.auth.jwt;

import com.infp.user.entity.User;
import com.infp.user.entity.UserStatus;
import com.infp.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtTokenProvider jwtTokenProvider, UserRepository userRepository) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userRepository = userRepository;
    }
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // CASE 1) 이미 인증된 상태 ==> PASS
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        // CASE 2) 쿠키에서 accessToken 추출
        String accessToken = extractCookie(request, "accessToken");

        // accessToken이 없으면 익명 사용자 처리
        if (accessToken == null || accessToken.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // 1) JWT 파싱 (서명 검증 + 만료 검증 )
            Claims claims = jwtTokenProvider.parseClaims(accessToken);

            // 2) ACCESS 토큰인지 확인 (refresh를 access로 사용하는 것 방지)
            String typ = claims.get("typ", String.class);
            if (!"ACCESS".equals(typ)) {
                filterChain.doFilter(request, response);
                return;
            }

            // 3) userId 꺼내기
            Long userId = ((Number) claims.get("userId")).longValue();

            // 4) DB 사용자 조회 및 상태 확인
            User user = userRepository.findById(userId).orElse(null);
            if (user == null || user.getStatus() != UserStatus.ACTIVE) {
                filterChain.doFilter(request, response);
                return;
            }

            // 5) Spring Security에 인증 등록
            var principal = new AuthPrincipal(user.getId(), user.getEmail(), user.getNickname(), user.getRole().name());

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, List.of());

            SecurityContextHolder.getContext().setAuthentication(authentication);


        } catch (ExpiredJwtException e) {
            // access 만료: 여기서 401을 직접 리턴하지 않는다
            // 프론트가 401을 받으면 /api/auth/refresh 시도하는 구조로 갈 것
            // -> 그냥 "익명"으로 통과시키면 보호 API에서 401이 떨어진다
        } catch (JwtException | IllegalArgumentException e) {
            // 서명 오류, 토큰 형태 오류 등 -> 익명처리 -> 401
        }
        filterChain.doFilter(request, response); // 다음 필터로 진행
    }
    // 특정 쿠키 값 꺼내는 유틸
    private String extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
    public record AuthPrincipal(Long userId, String email, String nickname, String role) {}
}
