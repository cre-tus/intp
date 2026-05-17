CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS gtfs;

DROP TABLE IF EXISTS gtfs.shape_geometries CASCADE;
DROP TABLE IF EXISTS gtfs.shapes CASCADE;
DROP TABLE IF EXISTS gtfs.translations CASCADE;
DROP TABLE IF EXISTS gtfs.transfers CASCADE;
DROP TABLE IF EXISTS gtfs.stop_times CASCADE;
DROP TABLE IF EXISTS gtfs.trips CASCADE;
DROP TABLE IF EXISTS gtfs.calendar_dates CASCADE;
DROP TABLE IF EXISTS gtfs.calendar CASCADE;
DROP TABLE IF EXISTS gtfs.routes CASCADE;
DROP TABLE IF EXISTS gtfs.stops CASCADE;
DROP TABLE IF EXISTS gtfs.feed_info CASCADE;
DROP TABLE IF EXISTS gtfs.attributions CASCADE;
DROP TABLE IF EXISTS gtfs.agency CASCADE;

CREATE TABLE gtfs.agency (
    agency_id text PRIMARY KEY,
    agency_name text NOT NULL,
    agency_url text NOT NULL,
    agency_timezone text NOT NULL,
    agency_lang text
);

CREATE TABLE gtfs.attributions (
    attribution_id text PRIMARY KEY,
    organization_name text,
    is_producer integer,
    is_operator integer,
    is_authority integer,
    is_data_source integer,
    attribution_url text
);

CREATE TABLE gtfs.feed_info (
    feed_publisher_name text NOT NULL,
    feed_publisher_url text NOT NULL,
    feed_lang text NOT NULL
);

CREATE TABLE gtfs.stops (
    stop_id text PRIMARY KEY,
    stop_code text,
    stop_name text NOT NULL,
    stop_lat double precision,
    stop_lon double precision,
    location_type integer,
    parent_station text,
    geom geometry(Point, 4326)
);

ALTER TABLE gtfs.stops
    ADD CONSTRAINT fk_gtfs_stops_parent_station
    FOREIGN KEY (parent_station)
    REFERENCES gtfs.stops(stop_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE gtfs.routes (
    route_id text PRIMARY KEY,
    agency_id text REFERENCES gtfs.agency(agency_id),
    route_short_name text,
    route_long_name text,
    route_type integer NOT NULL,
    route_color text,
    route_text_color text
);

CREATE TABLE gtfs.calendar (
    service_id text PRIMARY KEY,
    start_date date NOT NULL,
    end_date date NOT NULL,
    monday boolean NOT NULL,
    tuesday boolean NOT NULL,
    wednesday boolean NOT NULL,
    thursday boolean NOT NULL,
    friday boolean NOT NULL,
    saturday boolean NOT NULL,
    sunday boolean NOT NULL
);

CREATE TABLE gtfs.calendar_dates (
    service_id text NOT NULL REFERENCES gtfs.calendar(service_id),
    date date NOT NULL,
    exception_type integer NOT NULL,
    PRIMARY KEY (service_id, date)
);

CREATE TABLE gtfs.trips (
    trip_id text PRIMARY KEY,
    route_id text NOT NULL REFERENCES gtfs.routes(route_id),
    service_id text NOT NULL REFERENCES gtfs.calendar(service_id),
    trip_short_name text,
    trip_headsign text,
    direction_id integer,
    exceptional integer,
    shape_id text,
    block_id text,
    vehicle_kind text
);

CREATE TABLE gtfs.stop_times (
    trip_id text NOT NULL REFERENCES gtfs.trips(trip_id) ON DELETE CASCADE,
    stop_sequence integer NOT NULL,
    stop_id text NOT NULL REFERENCES gtfs.stops(stop_id),
    arrival_time text,
    departure_time text,
    arrival_seconds integer,
    departure_seconds integer,
    shape_dist_traveled double precision,
    PRIMARY KEY (trip_id, stop_sequence)
);

CREATE TABLE gtfs.transfers (
    from_trip_id text REFERENCES gtfs.trips(trip_id),
    to_trip_id text REFERENCES gtfs.trips(trip_id),
    transfer_type integer,
    PRIMARY KEY (from_trip_id, to_trip_id)
);

CREATE TABLE gtfs.translations (
    table_name text NOT NULL,
    record_id text NOT NULL,
    record_sub_id text,
    field_name text NOT NULL,
    language text NOT NULL,
    translation text NOT NULL
);

CREATE TABLE gtfs.shapes (
    shape_id text NOT NULL,
    shape_pt_sequence integer NOT NULL,
    shape_pt_lat double precision NOT NULL,
    shape_pt_lon double precision NOT NULL,
    shape_dist_traveled double precision,
    geom geometry(Point, 4326) NOT NULL,
    PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE TABLE gtfs.shape_geometries (
    shape_id text PRIMARY KEY,
    geom geometry(LineString, 4326) NOT NULL
);

CREATE INDEX idx_gtfs_stops_geom ON gtfs.stops USING gist (geom);
CREATE INDEX idx_gtfs_stops_parent_station ON gtfs.stops (parent_station);

CREATE INDEX idx_gtfs_routes_agency_id ON gtfs.routes (agency_id);

CREATE INDEX idx_gtfs_trips_route_id ON gtfs.trips (route_id);
CREATE INDEX idx_gtfs_trips_service_id ON gtfs.trips (service_id);
CREATE INDEX idx_gtfs_trips_shape_id ON gtfs.trips (shape_id);

CREATE INDEX idx_gtfs_stop_times_stop_id ON gtfs.stop_times (stop_id);
CREATE INDEX idx_gtfs_stop_times_trip_id ON gtfs.stop_times (trip_id);
CREATE INDEX idx_gtfs_stop_times_arrival_seconds ON gtfs.stop_times (arrival_seconds);

CREATE INDEX idx_gtfs_calendar_dates_date ON gtfs.calendar_dates (date);

CREATE INDEX idx_gtfs_translations_lookup
    ON gtfs.translations (table_name, record_id, field_name, language);

CREATE INDEX idx_gtfs_shapes_geom ON gtfs.shapes USING gist (geom);
CREATE INDEX idx_gtfs_shape_geometries_geom ON gtfs.shape_geometries USING gist (geom);

CREATE OR REPLACE FUNCTION gtfs.parse_gtfs_date(value text)
RETURNS date
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
    SELECT to_date(value, 'YYYYMMDD');
$$;

CREATE OR REPLACE FUNCTION gtfs.parse_gtfs_time_to_seconds(value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
    SELECT CASE
        WHEN value !~ '^[0-9]{1,3}:[0-9]{2}:[0-9]{2}$' THEN NULL
        ELSE split_part(value, ':', 1)::integer * 3600
           + split_part(value, ':', 2)::integer * 60
           + split_part(value, ':', 3)::integer
    END;
$$;
