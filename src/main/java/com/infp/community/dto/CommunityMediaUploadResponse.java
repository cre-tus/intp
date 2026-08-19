package com.infp.community.dto;

public record CommunityMediaUploadResponse(
        String mediaType,
        String mediaUrl,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        Integer durationSeconds
) {
}
