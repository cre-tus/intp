package com.infp.auth.dto;


// 로그인 상태 확인용 응답 DTO
// 프론트에서 누가 로그인 했는지? 알기 위한 메서드

public record MeResponse(Long id, String email, String nickname) {
}
