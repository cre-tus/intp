package com.infp.auth.controller;

import com.infp.auth.dto.EmailCheckResponse;
import com.infp.auth.dto.LoginRequest;
import com.infp.auth.dto.MeResponse;
import com.infp.auth.dto.RegisterRequest;
import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.auth.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(@RequestBody LoginRequest req, HttpServletResponse res) {
        System.out.println("Login HIT");
        // STEP 1) 로그인 처리
        // - 이메일로 유저 조회
        // - status 체크
        // - 비밀번호 matches()
        // - accessToken + refreshToken 생성
        var pair = authService.login(req); // pair.accessToken(), pair.refreshToken()

        // STEP 2) accessToken 쿠키 생성 (짧게)
        // - accessToken은 API 인증에 쓰는 토큰이라 짧게(예: 1시간)
        ResponseCookie accessCookie = ResponseCookie.from("accessToken", pair.accessToken())
                .httpOnly(true)     //  JS에서 쿠키 접근 불가 (XSS 방어)
                .secure(false)      //  로컬 개발은 false, HTTPS 배포면 true
                .sameSite("Lax")    //  기본적인 CSRF 완화
                .path("/")          //  모든 API 요청에 포함되도록
                .maxAge(60 * 60)    //  1시간 (예시)
                .build();

        // STEP 3) refreshToken 쿠키 생성 (길게 + rememberMe 반영)
        // - refreshToken은 accessToken 재발급 용도라 길게
        // - rememberMe=true면 30일 유지
        // - rememberMe=false면 세션 쿠키(브라우저 종료 시 삭제)로 처리
        ResponseCookie.ResponseCookieBuilder refreshBuilder = ResponseCookie.from("refreshToken", pair.refreshToken())
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                //  refresh 토큰은 재발급 엔드포인트에서만 쓰게 좁힐 수도 있다
                // .path("/api/auth/refresh")
                .path("/");

        ResponseCookie refreshCookie = req.rememberMe()
                ? refreshBuilder.maxAge(60L * 60 * 24 * 30).build() //  30일
                : refreshBuilder.build();                            //  세션 쿠키

        // STEP 4) 응답 헤더에 Set-Cookie를 "2개" 내려준다
        // - 브라우저는 받은 쿠키를 저장하고 이후 요청에 자동 포함한다
        res.addHeader("Set-Cookie", accessCookie.toString());
        res.addHeader("Set-Cookie", refreshCookie.toString());

        // STEP 5) 바디 없이 200 OK
        return ResponseEntity.ok().build();
    }

    @GetMapping("/check-email")
    public ResponseEntity<EmailCheckResponse> checkEmail(@RequestParam String email) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        return ResponseEntity.ok(new EmailCheckResponse(
                normalizedEmail,
                authService.isEmailAvailable(normalizedEmail)
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody RegisterRequest req) {
        authService.register(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            HttpServletResponse res
    ) {
        // 서비스 로직 호출
        if (refreshToken != null && !refreshToken.isBlank()) {
            authService.logoutByRefreshToken(refreshToken);
        }

        // 쿠키 삭제
        res.addHeader("Set-Cookie", deleteCookie("accessToken").toString());
        res.addHeader("Set-Cookie", deleteCookie("refreshToken").toString());

        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(
            // ✅ JwtAuthFilter에서 넣어준 principal 자동 주입
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        // 로그인 안 된 상태면 principal == null -> 401
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }

        // 로그인된 사용자 정보 반환
        return ResponseEntity.ok(
                new MeResponse(
                        principal.userId(),
                        principal.email(),
                        principal.nickname(),
                        principal.role()
                )
        );
    }

    //로그아웃 시 쿠키 삭제
    private ResponseCookie deleteCookie(String name) {
        return ResponseCookie.from(name, "")
                .path("/")
                .maxAge(0)
                .build();
    }

}
