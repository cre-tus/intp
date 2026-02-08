package com.infp.auth.dto;

public record LoginRequest(String email, String password, boolean rememberMe) { //rememberMe = 로그인 상태유지

}