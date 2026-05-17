BEGIN;

TRUNCATE
    gtfs.shape_geometries,
    gtfs.shapes,
    gtfs.translations,
    gtfs.transfers,
    gtfs.stop_times,
    gtfs.trips,
    gtfs.calendar_dates,
    gtfs.calendar,
    gtfs.routes,
    gtfs.stops,
    gtfs.feed_info,
    gtfs.attributions,
    gtfs.agency
RESTART IDENTITY CASCADE;

CREATE TEMP TABLE raw_agency (
    agency_id text,
    agency_name text,
    agency_url text,
    agency_timezone text,
    agency_lang text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_attributions (
    attribution_id text,
    organization_name text,
    attribution_url text,
    is_producer text,
    is_operator text,
    is_authority text,
    is_data_source text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_feed_info (
    feed_publisher_name text,
    feed_publisher_url text,
    feed_lang text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_stops (
    stop_id text,
    stop_code text,
    stop_name text,
    stop_lat text,
    stop_lon text,
    location_type text,
    parent_station text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_routes (
    agency_id text,
    route_id text,
    route_short_name text,
    route_long_name text,
    route_type text,
    route_color text,
    route_text_color text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_calendar (
    service_id text,
    start_date text,
    end_date text,
    monday text,
    tuesday text,
    wednesday text,
    thursday text,
    friday text,
    saturday text,
    sunday text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_calendar_dates (
    service_id text,
    date text,
    exception_type text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_trips (
    trip_id text,
    route_id text,
    service_id text,
    trip_short_name text,
    trip_headsign text,
    direction_id text,
    exceptional text,
    shape_id text,
    block_id text,
    vehicle_kind text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_stop_times (
    trip_id text,
    stop_sequence text,
    stop_id text,
    arrival_time text,
    departure_time text,
    shape_dist_traveled text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_transfers (
    from_trip_id text,
    to_trip_id text,
    transfer_type text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_translations (
    table_name text,
    record_id text,
    record_sub_id text,
    field_name text,
    language text,
    translation text
) ON COMMIT DROP;

CREATE TEMP TABLE raw_shapes (
    shape_id text,
    shape_pt_sequence text,
    shape_pt_lat text,
    shape_pt_lon text,
    shape_dist_traveled text
) ON COMMIT DROP;

\copy raw_agency FROM '/gtfs/tokyo_rail/agency.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_attributions FROM '/gtfs/tokyo_rail/attributions.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_feed_info FROM '/gtfs/tokyo_rail/feed_info.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_stops FROM '/gtfs/tokyo_rail/stops.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_routes FROM '/gtfs/tokyo_rail/routes.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_calendar FROM '/gtfs/tokyo_rail/calendar.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_calendar_dates FROM '/gtfs/tokyo_rail/calendar_dates.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_trips FROM '/gtfs/tokyo_rail/trips.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_stop_times FROM '/gtfs/tokyo_rail/stop_times.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_transfers FROM '/gtfs/tokyo_rail/transfers.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_translations FROM '/gtfs/tokyo_rail/translations.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')
\copy raw_shapes FROM '/gtfs/tokyo_rail/shapes.txt' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"')

INSERT INTO gtfs.agency (
    agency_id, agency_name, agency_url, agency_timezone, agency_lang
)
SELECT
    agency_id,
    agency_name,
    agency_url,
    agency_timezone,
    btrim(agency_lang)
FROM raw_agency;

INSERT INTO gtfs.attributions (
    attribution_id,
    organization_name,
    is_producer,
    is_operator,
    is_authority,
    is_data_source,
    attribution_url
)
SELECT
    attribution_id,
    organization_name,
    NULLIF(is_producer, '')::integer,
    NULLIF(is_operator, '')::integer,
    NULLIF(is_authority, '')::integer,
    NULLIF(is_data_source, '')::integer,
    attribution_url
FROM raw_attributions;

INSERT INTO gtfs.feed_info (
    feed_publisher_name, feed_publisher_url, feed_lang
)
SELECT feed_publisher_name, feed_publisher_url, feed_lang
FROM raw_feed_info;

INSERT INTO gtfs.stops (
    stop_id,
    stop_code,
    stop_name,
    stop_lat,
    stop_lon,
    location_type,
    parent_station,
    geom
)
SELECT
    stop_id,
    stop_code,
    stop_name,
    NULLIF(stop_lat, '')::double precision,
    NULLIF(stop_lon, '')::double precision,
    NULLIF(location_type, '')::integer,
    parent_station,
    CASE
        WHEN NULLIF(stop_lat, '') IS NULL OR NULLIF(stop_lon, '') IS NULL THEN NULL
        ELSE ST_SetSRID(
            ST_MakePoint(
                NULLIF(stop_lon, '')::double precision,
                NULLIF(stop_lat, '')::double precision
            ),
            4326
        )
    END
FROM raw_stops;

INSERT INTO gtfs.routes (
    route_id,
    agency_id,
    route_short_name,
    route_long_name,
    route_type,
    route_color,
    route_text_color
)
SELECT
    route_id,
    agency_id,
    route_short_name,
    route_long_name,
    route_type::integer,
    route_color,
    route_text_color
FROM raw_routes;

INSERT INTO gtfs.calendar (
    service_id,
    start_date,
    end_date,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday
)
SELECT
    service_id,
    gtfs.parse_gtfs_date(start_date),
    gtfs.parse_gtfs_date(end_date),
    monday = '1',
    tuesday = '1',
    wednesday = '1',
    thursday = '1',
    friday = '1',
    saturday = '1',
    sunday = '1'
FROM raw_calendar;

INSERT INTO gtfs.calendar_dates (
    service_id, date, exception_type
)
SELECT
    service_id,
    gtfs.parse_gtfs_date(date),
    exception_type::integer
FROM raw_calendar_dates;

INSERT INTO gtfs.trips (
    trip_id,
    route_id,
    service_id,
    trip_short_name,
    trip_headsign,
    direction_id,
    exceptional,
    shape_id,
    block_id,
    vehicle_kind
)
SELECT
    trip_id,
    route_id,
    service_id,
    trip_short_name,
    trip_headsign,
    NULLIF(direction_id, '')::integer,
    NULLIF(exceptional, '')::integer,
    shape_id,
    block_id,
    btrim(vehicle_kind)
FROM raw_trips;

INSERT INTO gtfs.stop_times (
    trip_id,
    stop_sequence,
    stop_id,
    arrival_time,
    departure_time,
    arrival_seconds,
    departure_seconds,
    shape_dist_traveled
)
SELECT
    trip_id,
    stop_sequence::integer,
    stop_id,
    arrival_time,
    departure_time,
    gtfs.parse_gtfs_time_to_seconds(arrival_time),
    gtfs.parse_gtfs_time_to_seconds(departure_time),
    NULLIF(shape_dist_traveled, '')::double precision
FROM raw_stop_times;

INSERT INTO gtfs.transfers (
    from_trip_id, to_trip_id, transfer_type
)
SELECT
    from_trip_id,
    to_trip_id,
    NULLIF(btrim(transfer_type), '')::integer
FROM raw_transfers;

INSERT INTO gtfs.translations (
    table_name,
    record_id,
    record_sub_id,
    field_name,
    language,
    translation
)
SELECT
    table_name,
    record_id,
    record_sub_id,
    field_name,
    language,
    translation
FROM raw_translations;

INSERT INTO gtfs.shapes (
    shape_id,
    shape_pt_sequence,
    shape_pt_lat,
    shape_pt_lon,
    shape_dist_traveled,
    geom
)
SELECT
    shape_id,
    shape_pt_sequence::integer,
    shape_pt_lat::double precision,
    shape_pt_lon::double precision,
    NULLIF(shape_dist_traveled, '')::double precision,
    ST_SetSRID(
        ST_MakePoint(
            shape_pt_lon::double precision,
            shape_pt_lat::double precision
        ),
        4326
    )
FROM raw_shapes;

INSERT INTO gtfs.shape_geometries (shape_id, geom)
SELECT
    shape_id,
    ST_MakeLine(geom ORDER BY shape_pt_sequence)
FROM gtfs.shapes
GROUP BY shape_id
HAVING COUNT(*) >= 2;

ANALYZE gtfs.agency;
ANALYZE gtfs.attributions;
ANALYZE gtfs.feed_info;
ANALYZE gtfs.stops;
ANALYZE gtfs.routes;
ANALYZE gtfs.calendar;
ANALYZE gtfs.calendar_dates;
ANALYZE gtfs.trips;
ANALYZE gtfs.stop_times;
ANALYZE gtfs.transfers;
ANALYZE gtfs.translations;
ANALYZE gtfs.shapes;
ANALYZE gtfs.shape_geometries;

COMMIT;
