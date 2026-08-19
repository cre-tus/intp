package com.infp.place;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class PlaceSchemaInitializer {
    public PlaceSchemaInitializer(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS place_memory (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    source VARCHAR(30) NOT NULL,
                    source_place_id VARCHAR(180) NOT NULL,
                    title VARCHAR(220) NOT NULL,
                    display_title VARCHAR(320) NULL,
                    title_ko VARCHAR(220) NULL,
                    title_en VARCHAR(220) NULL,
                    title_ja VARCHAR(220) NULL,
                    subtitle VARCHAR(600) NULL,
                    category VARCHAR(80) NOT NULL DEFAULT 'place',
                    place_type VARCHAR(120) NOT NULL DEFAULT 'unknown',
                    lat DOUBLE NOT NULL,
                    lon DOUBLE NOT NULL,
                    normalized_text VARCHAR(1200) NOT NULL,
                    selected_query VARCHAR(500) NULL,
                    selection_count INT NOT NULL DEFAULT 0,
                    last_selected_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_place_memory_source_place (source, source_place_id),
                    KEY idx_place_memory_selection (selection_count, last_selected_at)
                )
                """);
        Integer reviewColumnCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'review_count'
                """, Integer.class);
        if (reviewColumnCount == null || reviewColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE place_memory ADD COLUMN review_count INT NOT NULL DEFAULT 0 AFTER selection_count");
        }
        Integer googlePlaceIdColumnCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'google_place_id'
                """, Integer.class);
        if (googlePlaceIdColumnCount == null || googlePlaceIdColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE place_memory ADD COLUMN google_place_id VARCHAR(180) NULL AFTER source_place_id");
        }
        Integer expiryColumnCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'source_data_expires_at'
                """, Integer.class);
        if (expiryColumnCount == null || expiryColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE place_memory ADD COLUMN source_data_expires_at DATETIME(6) NULL AFTER google_place_id");
        }
        Integer categoryColumnCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'category'
                """, Integer.class);
        if (categoryColumnCount == null || categoryColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE place_memory ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT 'place' AFTER subtitle");
        }
        Integer placeTypeColumnCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'place_type'
                """, Integer.class);
        if (placeTypeColumnCount == null || placeTypeColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE place_memory ADD COLUMN place_type VARCHAR(120) NOT NULL DEFAULT 'unknown' AFTER category");
        }
        jdbcTemplate.update("UPDATE place_memory SET category = 'place' WHERE category IS NULL OR category = ''");
        jdbcTemplate.update("UPDATE place_memory SET place_type = 'unknown' WHERE place_type IS NULL OR place_type = ''");
        jdbcTemplate.execute("ALTER TABLE place_memory MODIFY category VARCHAR(80) NOT NULL DEFAULT 'place'");
        jdbcTemplate.execute("ALTER TABLE place_memory MODIFY place_type VARCHAR(120) NOT NULL DEFAULT 'unknown'");
        jdbcTemplate.update("""
                UPDATE place_memory
                SET google_place_id = source_place_id
                WHERE UPPER(source) = 'GOOGLE'
                  AND (google_place_id IS NULL OR google_place_id = '')
                """);
        Integer reviewIndexCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND index_name = 'idx_place_memory_review'
                """, Integer.class);
        if (reviewIndexCount == null || reviewIndexCount == 0) {
            jdbcTemplate.execute("CREATE INDEX idx_place_memory_review ON place_memory (review_count, updated_at)");
        }
        Integer coordinateKeyCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND column_name = 'coordinate_key'
                """, Integer.class);
        if (coordinateKeyCount == null || coordinateKeyCount == 0) {
            jdbcTemplate.execute("""
                    ALTER TABLE place_memory
                    ADD COLUMN coordinate_key VARCHAR(64)
                    GENERATED ALWAYS AS (CONCAT(ROUND(lat, 6), ',', ROUND(lon, 6))) STORED
                    """);
        }
        Integer uniqueCoordinateIndexCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND index_name = 'uk_place_memory_coordinate'
                """, Integer.class);
        if (uniqueCoordinateIndexCount != null && uniqueCoordinateIndexCount > 0) {
            jdbcTemplate.execute("DROP INDEX uk_place_memory_coordinate ON place_memory");
        }
        Integer coordinateIndexCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'place_memory' AND index_name = 'idx_place_memory_coordinate'
                """, Integer.class);
        if (coordinateIndexCount == null || coordinateIndexCount == 0) {
            jdbcTemplate.execute("CREATE INDEX idx_place_memory_coordinate ON place_memory (coordinate_key)");
        }
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS place_search_learning (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    country_code VARCHAR(2) NOT NULL,
                    normalized_query VARCHAR(300) NOT NULL,
                    compact_query VARCHAR(300) NOT NULL,
                    source VARCHAR(30) NOT NULL,
                    source_place_id VARCHAR(180) NOT NULL,
                    discovery_count INT NOT NULL DEFAULT 0,
                    selection_count INT NOT NULL DEFAULT 0,
                    last_discovered_at DATETIME(6) NULL,
                    last_selected_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_place_search_learning_query_place
                        (country_code, normalized_query, source, source_place_id),
                    KEY idx_place_search_learning_compact (compact_query),
                    KEY idx_place_search_learning_place (source, source_place_id),
                    KEY idx_place_search_learning_rank (selection_count, discovery_count, last_selected_at)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS place_learning_imports (
                    import_key CHAR(64) NOT NULL,
                    source_sha256 CHAR(64) NOT NULL,
                    normalized_query VARCHAR(300) NOT NULL,
                    source_place_id VARCHAR(180) NOT NULL,
                    imported_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (import_key),
                    KEY idx_place_learning_import_source (source_sha256)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS retained_google_place_ids (
                    place_id VARCHAR(180) NOT NULL,
                    first_seen_at DATETIME(6) NOT NULL,
                    last_seen_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (place_id)
                )
                """);
        jdbcTemplate.update("""
                INSERT INTO place_search_learning (
                    country_code, normalized_query, compact_query, source, source_place_id,
                    discovery_count, selection_count, last_discovered_at, last_selected_at, created_at, updated_at
                )
                SELECT 'JP',
                       LEFT(LOWER(COALESCE(NULLIF(pm.selected_query, ''), NULLIF(pm.display_title, ''), pm.title)), 300),
                       LEFT(REPLACE(LOWER(COALESCE(NULLIF(pm.selected_query, ''), NULLIF(pm.display_title, ''), pm.title)), ' ', ''), 300),
                       pm.source, pm.source_place_id,
                       0, GREATEST(pm.selection_count, 1), NULL, pm.last_selected_at, NOW(6), NOW(6)
                  FROM place_memory pm
                 WHERE pm.selection_count > 0
                   AND pm.review_count >= 1
                   AND UPPER(pm.source) IN ('NOMINATIM', 'LOCAL', 'MANUAL')
                   AND NOT EXISTS (
                       SELECT 1
                         FROM place_search_learning psl
                        WHERE psl.country_code = 'JP'
                          AND psl.source = pm.source
                          AND psl.source_place_id = pm.source_place_id
                   )
                """);
        jdbcTemplate.update("DELETE FROM place_search_learning WHERE selection_count = 0");
        jdbcTemplate.update("DELETE FROM place_memory WHERE selection_count = 0");
    }
}
