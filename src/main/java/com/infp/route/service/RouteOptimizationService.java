package com.infp.route.service;

import com.infp.route.dto.RouteCompareResponse;
import com.infp.route.dto.RouteCostMatrixResponse;
import com.infp.route.dto.RouteLeg;
import com.infp.route.dto.RouteOptimizationResponse;
import com.infp.route.dto.RoutePoint;
import com.infp.route.dto.TransitStop;
import com.infp.route.gtfs.GtfsTransitService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RouteOptimizationService {

    private static final int MAX_POINTS = 5;
    private final GtfsTransitService gtfsTransitService;

    public RouteOptimizationService(GtfsTransitService gtfsTransitService) {
        this.gtfsTransitService = gtfsTransitService;
    }

    public RouteOptimizationResponse optimize(List<RoutePoint> points) {
        long started = System.nanoTime();
        List<RoutePoint> normalized = validateAndNormalize(points);
        CostMatrix matrix = buildCostMatrix(normalized);

        if (normalized.size() <= 2) {
            return buildResponse(normalized, matrix, started);
        }

        BestRoute best = new BestRoute();
        permute(normalized, 0, best, matrix);
        return buildResponse(best.order, matrix, started);
    }

    public RouteCompareResponse compare(List<RoutePoint> manualOrder) {
        long started = System.nanoTime();
        List<RoutePoint> normalized = validateAndNormalize(manualOrder);
        CostMatrix matrix = buildCostMatrix(normalized);
        RouteOptimizationResponse manual = buildResponse(normalized, matrix, started);
        RouteOptimizationResponse optimized = optimize(normalized);

        double savedDistance = roundKm(manual.totalDistanceKm() - optimized.totalDistanceKm());
        int savedMinutes = manual.totalMinutes() - optimized.totalMinutes();
        double improvementPercent = manual.totalMinutes() == 0
                ? 0
                : Math.max(0, (savedMinutes * 100.0) / manual.totalMinutes());

        return new RouteCompareResponse(
                manual,
                optimized,
                savedDistance,
                savedMinutes,
                Math.round(improvementPercent * 10.0) / 10.0
        );
    }

    public RouteCostMatrixResponse costMatrix(List<RoutePoint> points) {
        List<RoutePoint> normalized = validateAndNormalize(points);
        CostMatrix matrix = buildCostMatrix(normalized);
        return new RouteCostMatrixResponse(
                List.copyOf(normalized),
                matrix.minutes,
                matrix.distanceKm,
                List.copyOf(matrix.nearestStops),
                GtfsTransitService.COST_MODEL
        );
    }

    public List<TransitStop> nearbyStops(double lat, double lon, int radiusMeters, int limit) {
        return gtfsTransitService.findNearbyStops(lat, lon, radiusMeters, limit);
    }

    private List<RoutePoint> validateAndNormalize(List<RoutePoint> points) {
        if (points == null || points.size() < 2) {
            throw new IllegalArgumentException("At least 2 destinations with coordinates are required.");
        }
        if (points.size() > MAX_POINTS) {
            throw new IllegalArgumentException("Route optimization supports up to 5 destinations.");
        }

        List<RoutePoint> normalized = new ArrayList<>();
        for (int i = 0; i < points.size(); i++) {
            RoutePoint point = points.get(i);
            if (point == null || !isValidCoordinate(point.lat(), point.lon())) {
                throw new IllegalArgumentException("Invalid coordinate at destination " + (i + 1));
            }
            normalized.add(new RoutePoint(
                    blankToFallback(point.id(), "point-" + i),
                    blankToFallback(point.name(), "Destination " + (i + 1)),
                    point.lat(),
                    point.lon(),
                    point.originalIndex() == null ? i : point.originalIndex()
            ));
        }
        return normalized;
    }

    private void permute(List<RoutePoint> points, int index, BestRoute best, CostMatrix matrix) {
        if (index == points.size()) {
            int minutes = totalMinutes(points, matrix);
            if (minutes < best.minutes) {
                best.minutes = minutes;
                best.order = new ArrayList<>(points);
            }
            return;
        }

        for (int i = index; i < points.size(); i++) {
            swap(points, index, i);
            permute(points, index + 1, best, matrix);
            swap(points, index, i);
        }
    }

    private RouteOptimizationResponse buildResponse(List<RoutePoint> order, CostMatrix matrix, long startedNanos) {
        List<RouteLeg> legs = new ArrayList<>();
        double totalDistance = 0;
        int totalMinutes = 0;

        for (int i = 0; i < order.size() - 1; i++) {
            RoutePoint from = order.get(i);
            RoutePoint to = order.get(i + 1);
            int fromIndex = matrix.indexOf(from);
            int toIndex = matrix.indexOf(to);
            double distance = matrix.distanceKm[fromIndex][toIndex];
            int minutes = matrix.minutes[fromIndex][toIndex];

            legs.add(new RouteLeg(
                    from,
                    to,
                    roundKm(distance),
                    minutes,
                    matrix.nearestStops.get(fromIndex),
                    matrix.nearestStops.get(toIndex)
            ));
            totalDistance += distance;
            totalMinutes += minutes;
        }

        long elapsedMillis = (System.nanoTime() - startedNanos) / 1_000_000;
        return new RouteOptimizationResponse(
                List.copyOf(order),
                legs,
                orderedMinutes(order, matrix),
                orderedDistances(order, matrix),
                orderedStops(order, matrix),
                roundKm(totalDistance),
                totalMinutes,
                elapsedMillis,
                GtfsTransitService.COST_MODEL
        );
    }

    private CostMatrix buildCostMatrix(List<RoutePoint> points) {
        int size = points.size();
        int[][] minutes = new int[size][size];
        double[][] distanceKm = new double[size][size];
        List<TransitStop> nearestStops = points.stream()
                .map(gtfsTransitService::nearestStop)
                .toList();

        for (int i = 0; i < size; i++) {
            for (int j = 0; j < size; j++) {
                if (i == j) continue;
                GtfsTransitService.CostEstimate estimate = gtfsTransitService.estimateCost(points.get(i), points.get(j));
                minutes[i][j] = estimate.minutes();
                distanceKm[i][j] = estimate.distanceKm();
            }
        }

        return new CostMatrix(points, minutes, distanceKm, nearestStops);
    }

    private int totalMinutes(List<RoutePoint> order, CostMatrix matrix) {
        int total = 0;
        for (int i = 0; i < order.size() - 1; i++) {
            total += matrix.minutes[matrix.indexOf(order.get(i))][matrix.indexOf(order.get(i + 1))];
        }
        return total;
    }

    private int[][] orderedMinutes(List<RoutePoint> order, CostMatrix matrix) {
        int[][] ordered = new int[order.size()][order.size()];
        for (int i = 0; i < order.size(); i++) {
            for (int j = 0; j < order.size(); j++) {
                ordered[i][j] = matrix.minutes[matrix.indexOf(order.get(i))][matrix.indexOf(order.get(j))];
            }
        }
        return ordered;
    }

    private double[][] orderedDistances(List<RoutePoint> order, CostMatrix matrix) {
        double[][] ordered = new double[order.size()][order.size()];
        for (int i = 0; i < order.size(); i++) {
            for (int j = 0; j < order.size(); j++) {
                ordered[i][j] = matrix.distanceKm[matrix.indexOf(order.get(i))][matrix.indexOf(order.get(j))];
            }
        }
        return ordered;
    }

    private List<TransitStop> orderedStops(List<RoutePoint> order, CostMatrix matrix) {
        return order.stream()
                .map(point -> matrix.nearestStops.get(matrix.indexOf(point)))
                .toList();
    }

    private boolean isValidCoordinate(double lat, double lon) {
        return Double.isFinite(lat)
                && Double.isFinite(lon)
                && lat >= -90
                && lat <= 90
                && lon >= -180
                && lon <= 180;
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private void swap(List<RoutePoint> points, int left, int right) {
        RoutePoint temp = points.get(left);
        points.set(left, points.get(right));
        points.set(right, temp);
    }

    private double roundKm(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static class BestRoute {
        private List<RoutePoint> order = List.of();
        private int minutes = Integer.MAX_VALUE;
    }

    private record CostMatrix(
            List<RoutePoint> points,
            int[][] minutes,
            double[][] distanceKm,
            List<TransitStop> nearestStops
    ) {
        int indexOf(RoutePoint point) {
            int index = points.indexOf(point);
            if (index < 0) {
                throw new IllegalArgumentException("경로 비용 행렬에 없는 목적지입니다.");
            }
            return index;
        }
    }
}
