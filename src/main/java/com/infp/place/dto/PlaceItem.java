package com.infp.place.dto;


public record PlaceItem(
        String id,          // place:141643 같은 고유 키
        String title,       // 표시 이름(짧게)
        String subtitle,    // display_name 전체
        double lat,
        double lon,
        double importance,  // 정렬용
        String sourceQuery  // 어떤 후보로 검색했는지
) {}

