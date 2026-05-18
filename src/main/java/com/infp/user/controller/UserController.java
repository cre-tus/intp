package com.infp.user.controller;

import com.infp.user.dto.UserLookupResponse;
import com.infp.user.entity.User;
import com.infp.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/by-email")
    public ResponseEntity<UserLookupResponse> findByEmail(@RequestParam String email) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(normalizedEmail)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private UserLookupResponse toResponse(User user) {
        String nickname = user.getNickname();
        if (nickname == null || nickname.isBlank()) {
            nickname = (user.getFirstName() + user.getLastName()).trim();
        }
        if (nickname.isBlank()) {
            nickname = user.getEmail();
        }
        return new UserLookupResponse(user.getId(), user.getEmail(), nickname);
    }
}
