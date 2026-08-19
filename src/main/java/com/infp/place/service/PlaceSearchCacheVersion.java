package com.infp.place.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class PlaceSearchCacheVersion {
    private static final String GENERATION_KEY = "place:search:memory-generation";

    private final StringRedisTemplate redisTemplate;

    public PlaceSearchCacheVersion(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public long current() {
        try {
            String value = redisTemplate.opsForValue().get(GENERATION_KEY);
            return value == null ? 0 : Long.parseLong(value);
        } catch (Exception ignored) {
            return 0;
        }
    }

    public void advance() {
        try {
            redisTemplate.opsForValue().increment(GENERATION_KEY);
        } catch (Exception ignored) {
            // Redis is an optimization; persisted search learning remains authoritative.
        }
    }
}
