package com.infp.community;

import com.infp.community.dto.CommunityMediaUploadResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class CommunityMediaStorageService {
    private static final long MAX_MEDIA_BYTES = 80L * 1024L * 1024L;
    private static final int MAX_VIDEO_SECONDS = 299;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/webm", "video/quicktime");

    private final Path uploadRoot;

    public CommunityMediaStorageService(
            @Value("${community.media.upload-dir:uploads/community-media}") String uploadDir
    ) {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public CommunityMediaUploadResponse store(MultipartFile file, Integer durationSeconds) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("업로드할 파일을 선택해주세요.");
        if (file.getSize() > MAX_MEDIA_BYTES) throw new IllegalArgumentException("미디어 파일은 80MB 이하만 업로드할 수 있습니다.");

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String mediaType = resolveMediaType(contentType);
        if (mediaType == null) throw new IllegalArgumentException("사진 또는 동영상 파일만 업로드할 수 있습니다.");
        if ("video".equals(mediaType) && (durationSeconds == null || durationSeconds > MAX_VIDEO_SECONDS)) {
            throw new IllegalArgumentException("동영상은 5분 미만만 업로드할 수 있습니다.");
        }

        LocalDate today = LocalDate.now();
        String extension = extension(contentType);
        String filename = UUID.randomUUID() + extension;
        Path directory = uploadRoot
                .resolve(String.valueOf(today.getYear()))
                .resolve(String.format("%02d", today.getMonthValue()));
        Path target = directory.resolve(filename).normalize();
        if (!target.startsWith(uploadRoot)) throw new IllegalArgumentException("잘못된 파일 경로입니다.");

        try {
            Files.createDirectories(directory);
            file.transferTo(target);
        } catch (IOException e) {
            throw new IllegalStateException("파일 저장에 실패했습니다.", e);
        }

        String publicUrl = "/uploads/community-media/%d/%02d/%s".formatted(today.getYear(), today.getMonthValue(), filename);
        return new CommunityMediaUploadResponse(
                mediaType,
                publicUrl,
                file.getOriginalFilename(),
                contentType,
                file.getSize(),
                "video".equals(mediaType) ? durationSeconds : null
        );
    }

    public void deleteByPublicUrl(String publicUrl) {
        String prefix = "/uploads/community-media/";
        if (publicUrl == null || !publicUrl.startsWith(prefix)) return;

        String relativePath = publicUrl.substring(prefix.length());
        Path target = uploadRoot.resolve(relativePath).normalize();
        if (!target.startsWith(uploadRoot)) return;
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // A failed cleanup must not roll back an already committed post update.
        }
    }

    private String resolveMediaType(String contentType) {
        if (IMAGE_TYPES.contains(contentType)) return "image";
        if (VIDEO_TYPES.contains(contentType)) return "video";
        return null;
    }

    private String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            default -> throw new IllegalArgumentException("지원하지 않는 미디어 형식입니다.");
        };
    }
}
