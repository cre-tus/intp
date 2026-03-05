package com.infp.place.util;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class QueryVariantBuilder {

    private static final List<String> SUFFIXES = List.of(
            "역", "타워", "랜드", "카페", "공항", "호텔", "공원", "대학교", "터미널", "고등학교"
    );

    public static List<String> build(String q) {
        String s = q.trim();
        if (s.isEmpty()) return List.of();

        Set<String> set = new LinkedHashSet<>();
        set.add(s); // 원본
        set.add(s.replace(" ", "")); // 붙여쓰기

        for (String suf : SUFFIXES) {
            if (s.endsWith(suf)) {
                String base = s.substring(0, s.length() - suf.length()); // 전체 문자열 길이 - 접미사 길이
                set.add(base + " " + suf); // 띄워쓰기 보정
            }
        }
        return set.stream().distinct().limit(6).toList();
    }
}
