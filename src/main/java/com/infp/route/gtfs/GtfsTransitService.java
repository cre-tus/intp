package com.infp.route.gtfs;

import com.infp.route.dto.RoutePoint;
import com.infp.route.dto.TransitStop;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class GtfsTransitService {

    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final double WALK_SPEED_KMH = 4.8;
    private static final double TRANSIT_SPEED_KMH = 32.0;
    private static final int BOARDING_WAIT_MINUTES = 6;
    private static final int DEFAULT_STOP_LIMIT = 8;
    public static final String COST_MODEL =
            "GTFS nearest-stop estimate: walk to nearest stop, transit-distance estimate, walk from stop, 6min wait buffer";

    private final Path datasetDir;
    private final List<StopRow> stops = new ArrayList<>();
    private final Map<String, List<String>> routeNamesByStopId = new HashMap<>();

    public GtfsTransitService(@Value("${gtfs.dataset-dir:db/gtfs/tokyo_rail}") String datasetDir) {
        this.datasetDir = Path.of(datasetDir);
    }

    @PostConstruct
    void loadDataset() {
        try {
            loadStops();
        } catch (IOException exception) {
            throw new IllegalStateException("GTFS 데이터셋을 읽을 수 없습니다: " + datasetDir.toAbsolutePath(), exception);
        }
    }

    public List<TransitStop> findNearbyStops(double lat, double lon, int radiusMeters, int limit) {
        validateCoordinate(lat, lon);
        int safeRadius = radiusMeters <= 0 ? 800 : Math.min(radiusMeters, 5000);
        int safeLimit = limit <= 0 ? DEFAULT_STOP_LIMIT : Math.min(limit, 30);

        return stops.stream()
                .map(stop -> stop.toTransitStop(distanceMeters(lat, lon, stop.lat(), stop.lon()), routeNamesByStopId))
                .filter(stop -> stop.distanceMeters() <= safeRadius)
                .sorted(Comparator.comparingInt(TransitStop::distanceMeters))
                .limit(safeLimit)
                .toList();
    }

    public TransitStop nearestStop(RoutePoint point) {
        validateCoordinate(point.lat(), point.lon());
        return stops.stream()
                .map(stop -> stop.toTransitStop(distanceMeters(point.lat(), point.lon(), stop.lat(), stop.lon()), routeNamesByStopId))
                .min(Comparator.comparingInt(TransitStop::distanceMeters))
                .orElseThrow(() -> new IllegalStateException("GTFS 정류장 데이터가 비어 있습니다."));
    }

    public CostEstimate estimateCost(RoutePoint from, RoutePoint to) {
        TransitStop fromStop = nearestStop(from);
        TransitStop toStop = nearestStop(to);

        double walkKm = fromStop.distanceMeters() / 1000.0 + toStop.distanceMeters() / 1000.0;
        double stopDistanceKm = distanceKm(fromStop.lat(), fromStop.lon(), toStop.lat(), toStop.lon());
        double totalDistanceKm = walkKm + stopDistanceKm;

        int walkMinutes = (int) Math.ceil((walkKm / WALK_SPEED_KMH) * 60.0);
        int transitMinutes = (int) Math.ceil((stopDistanceKm / TRANSIT_SPEED_KMH) * 60.0);
        int totalMinutes = walkMinutes + transitMinutes + BOARDING_WAIT_MINUTES;

        return new CostEstimate(roundKm(totalDistanceKm), Math.max(1, totalMinutes), fromStop, toStop);
    }

    private void loadStops() throws IOException {
        Path stopsFile = datasetDir.resolve("stops.txt");
        try (BufferedReader reader = Files.newBufferedReader(stopsFile, StandardCharsets.UTF_8)) {
            List<String> header = parseCsvLine(reader.readLine());
            int idIdx = header.indexOf("stop_id");
            int nameIdx = header.indexOf("stop_name");
            int latIdx = header.indexOf("stop_lat");
            int lonIdx = header.indexOf("stop_lon");
            int parentIdx = header.indexOf("parent_station");

            String line;
            while ((line = reader.readLine()) != null) {
                List<String> row = parseCsvLine(line);
                String stopId = get(row, idIdx);
                String parent = get(row, parentIdx);
                if (stopId.isBlank() || !parent.isBlank()) continue;

                double lat = parseDouble(get(row, latIdx));
                double lon = parseDouble(get(row, lonIdx));
                if (isValidCoordinate(lat, lon)) {
                    stops.add(new StopRow(stopId, get(row, nameIdx), lat, lon));
                }
            }
        }
    }

    private void loadRoutesByStop() throws IOException {
        Map<String, String> routeNames = loadRouteNames();
        Map<String, String> tripRouteIds = loadTripRouteIds();
        Map<String, Set<String>> routesByStop = new HashMap<>();

        Path stopTimesFile = datasetDir.resolve("stop_times.txt");
        try (BufferedReader reader = Files.newBufferedReader(stopTimesFile, StandardCharsets.UTF_8)) {
            List<String> header = parseCsvLine(reader.readLine());
            int tripIdx = header.indexOf("trip_id");
            int stopIdx = header.indexOf("stop_id");

            String line;
            while ((line = reader.readLine()) != null) {
                List<String> row = parseCsvLine(line);
                String routeId = tripRouteIds.get(get(row, tripIdx));
                String stopId = get(row, stopIdx);
                if (routeId == null || stopId.isBlank()) continue;
                routesByStop.computeIfAbsent(stopId, ignored -> new HashSet<>())
                        .add(routeNames.getOrDefault(routeId, routeId));
            }
        }

        for (Map.Entry<String, Set<String>> entry : routesByStop.entrySet()) {
            routeNamesByStopId.put(entry.getKey(), entry.getValue().stream().sorted().limit(5).toList());
        }
    }

    private Map<String, String> loadRouteNames() throws IOException {
        Map<String, String> routeNames = new HashMap<>();
        Path routesFile = datasetDir.resolve("routes.txt");
        try (BufferedReader reader = Files.newBufferedReader(routesFile, StandardCharsets.UTF_8)) {
            List<String> header = parseCsvLine(reader.readLine());
            int idIdx = header.indexOf("route_id");
            int shortIdx = header.indexOf("route_short_name");
            int longIdx = header.indexOf("route_long_name");

            String line;
            while ((line = reader.readLine()) != null) {
                List<String> row = parseCsvLine(line);
                String routeId = get(row, idIdx);
                String routeName = !get(row, shortIdx).isBlank() ? get(row, shortIdx) : get(row, longIdx);
                if (!routeId.isBlank()) routeNames.put(routeId, routeName.isBlank() ? routeId : routeName);
            }
        }
        return routeNames;
    }

    private Map<String, String> loadTripRouteIds() throws IOException {
        Map<String, String> tripRouteIds = new HashMap<>();
        Path tripsFile = datasetDir.resolve("trips.txt");
        try (BufferedReader reader = Files.newBufferedReader(tripsFile, StandardCharsets.UTF_8)) {
            List<String> header = parseCsvLine(reader.readLine());
            int tripIdx = header.indexOf("trip_id");
            int routeIdx = header.indexOf("route_id");

            String line;
            while ((line = reader.readLine()) != null) {
                List<String> row = parseCsvLine(line);
                String tripId = get(row, tripIdx);
                if (!tripId.isBlank()) tripRouteIds.put(tripId, get(row, routeIdx));
            }
        }
        return tripRouteIds;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        if (line == null) return values;
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        values.add(current.toString());
        return values;
    }

    private static String get(List<String> row, int index) {
        return index >= 0 && index < row.size() ? row.get(index).trim() : "";
    }

    private static double parseDouble(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return Double.NaN;
        }
    }

    private static int distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        return (int) Math.round(distanceKm(lat1, lon1, lat2, lon2) * 1000.0);
    }

    private static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double aLat = Math.toRadians(lat1);
        double bLat = Math.toRadians(lat2);
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(aLat) * Math.cos(bLat)
                * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static void validateCoordinate(double lat, double lon) {
        if (!isValidCoordinate(lat, lon)) {
            throw new IllegalArgumentException("유효하지 않은 좌표입니다.");
        }
    }

    private static boolean isValidCoordinate(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private static double roundKm(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record StopRow(String id, String name, double lat, double lon) {
        TransitStop toTransitStop(int distanceMeters, Map<String, List<String>> routeNamesByStopId) {
            return new TransitStop(id, name, lat, lon, distanceMeters,
                    routeNamesByStopId.getOrDefault(id, List.of()));
        }
    }

    public record CostEstimate(
            double distanceKm,
            int minutes,
            TransitStop fromStop,
            TransitStop toStop
    ) {
    }
}
