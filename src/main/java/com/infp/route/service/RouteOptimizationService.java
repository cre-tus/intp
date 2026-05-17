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
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class RouteOptimizationService {

    private static final int MAX_POINTS = 10;
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

        List<RoutePoint> optimized = optimizeWithConstraints(normalized, matrix);
        return buildResponse(optimized, matrix, started);
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
            throw new IllegalArgumentException("Route optimization supports up to 10 destinations.");
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
                    point.originalIndex() == null ? i : point.originalIndex(),
                    normalizeRole(point.routeRole())
            ));
        }
        return normalized;
    }

    private String normalizeRole(String value) {
        if (value == null || value.isBlank()) return "NONE";
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private List<RoutePoint> optimizeWithConstraints(List<RoutePoint> points, CostMatrix matrix) {
        RoutePoint lodging = firstByRole(points, "LODGING");
        RoutePoint start = lodging != null ? lodging : firstByRole(points, "START");
        RoutePoint end = lodging != null ? lodging : firstByRole(points, "END");
        List<RoutePoint> fixed = points.stream()
                .filter(point -> "FIXED".equals(point.routeRole()))
                .sorted(Comparator.comparingInt(point -> point.originalIndex() == null ? Integer.MAX_VALUE : point.originalIndex()))
                .toList();

        if (start == null && end == null && fixed.isEmpty()) {
            return optimizeWithTwoOpt(points, matrix);
        }

        List<RoutePoint> anchors = new ArrayList<>();
        if (start != null) anchors.add(start);
        for (RoutePoint point : fixed) {
            if (!anchors.contains(point)) anchors.add(point);
        }
        if (end != null && !anchors.contains(end)) anchors.add(end);

        List<RoutePoint> route = new ArrayList<>();
        Set<RoutePoint> used = new HashSet<>();
        if (start != null) {
            route.add(start);
            used.add(start);
        }

        for (RoutePoint anchor : anchors) {
            if (used.contains(anchor) && anchor != end) continue;
            RoutePoint previousAnchor = route.isEmpty() ? null : route.get(route.size() - 1);
            List<RoutePoint> segment = points.stream()
                    .filter(point -> !used.contains(point))
                    .filter(point -> !anchors.contains(point))
                    .filter(point -> belongsBetween(point, previousAnchor, anchor))
                    .toList();
            route.addAll(optimizeSegment(segment, previousAnchor, anchor, matrix));
            used.addAll(segment);
            if (!used.contains(anchor)) {
                route.add(anchor);
                used.add(anchor);
            }
        }

        List<RoutePoint> remaining = points.stream()
                .filter(point -> !used.contains(point))
                .filter(point -> !anchors.contains(point))
                .toList();
        route.addAll(optimizeSegment(remaining, route.isEmpty() ? null : route.get(route.size() - 1), end, matrix));
        used.addAll(remaining);

        if (end != null && (route.isEmpty() || !route.get(route.size() - 1).equals(end))) {
            route.add(end);
        }

        return route;
    }

    private RoutePoint firstByRole(List<RoutePoint> points, String role) {
        return points.stream()
                .filter(point -> role.equals(point.routeRole()))
                .findFirst()
                .orElse(null);
    }

    private boolean belongsBetween(RoutePoint point, RoutePoint previousAnchor, RoutePoint nextAnchor) {
        int pointOrder = point.originalIndex() == null ? Integer.MAX_VALUE : point.originalIndex();
        int min = previousAnchor == null || previousAnchor.originalIndex() == null || isStartAnchor(previousAnchor)
                ? Integer.MIN_VALUE
                : previousAnchor.originalIndex();
        int max = nextAnchor == null || nextAnchor.originalIndex() == null || isEndAnchor(nextAnchor)
                ? Integer.MAX_VALUE
                : nextAnchor.originalIndex();
        return pointOrder > min && pointOrder < max;
    }

    private boolean isStartAnchor(RoutePoint point) {
        return "START".equals(point.routeRole()) || "LODGING".equals(point.routeRole());
    }

    private boolean isEndAnchor(RoutePoint point) {
        return "END".equals(point.routeRole()) || "LODGING".equals(point.routeRole());
    }

    private List<RoutePoint> optimizeSegment(List<RoutePoint> points, RoutePoint start, RoutePoint end, CostMatrix matrix) {
        if (points.size() <= 1) return List.copyOf(points);

        List<RoutePoint> best = List.copyOf(points);
        int bestMinutes = totalMinutesWithBounds(best, start, end, matrix);

        if (start != null) {
            List<RoutePoint> candidate = nearestNeighborRoute(points, matrix, start);
            candidate = improveSegmentWithTwoOpt(candidate, start, end, matrix);
            int candidateMinutes = totalMinutesWithBounds(candidate, start, end, matrix);
            if (candidateMinutes < bestMinutes) {
                best = candidate;
                bestMinutes = candidateMinutes;
            }
        }

        for (int i = 0; i < points.size(); i++) {
            List<RoutePoint> candidate = nearestNeighborRoute(points, matrix, i);
            candidate = improveSegmentWithTwoOpt(candidate, start, end, matrix);
            int candidateMinutes = totalMinutesWithBounds(candidate, start, end, matrix);
            if (candidateMinutes < bestMinutes) {
                best = candidate;
                bestMinutes = candidateMinutes;
            }
        }

        return best;
    }

    private List<RoutePoint> optimizeWithTwoOpt(List<RoutePoint> points, CostMatrix matrix) {
        List<RoutePoint> best = new ArrayList<>(points);
        int bestMinutes = totalMinutes(best, matrix);

        for (int start = 0; start < points.size(); start++) {
            List<RoutePoint> candidate = nearestNeighborRoute(points, matrix, start);
            candidate = improveWithTwoOpt(candidate, matrix);
            int candidateMinutes = totalMinutes(candidate, matrix);
            if (candidateMinutes < bestMinutes) {
                best = candidate;
                bestMinutes = candidateMinutes;
            }
        }

        return best;
    }

    private List<RoutePoint> nearestNeighborRoute(List<RoutePoint> points, CostMatrix matrix, int startIndex) {
        List<RoutePoint> route = new ArrayList<>();
        boolean[] used = new boolean[points.size()];
        int current = startIndex;

        route.add(points.get(current));
        used[current] = true;

        while (route.size() < points.size()) {
            int next = -1;
            int bestMinutes = Integer.MAX_VALUE;
            for (int i = 0; i < points.size(); i++) {
                if (used[i]) continue;
                int minutes = matrix.minutes[current][i];
                if (minutes < bestMinutes) {
                    bestMinutes = minutes;
                    next = i;
                }
            }
            if (next < 0) break;
            route.add(points.get(next));
            used[next] = true;
            current = next;
        }

        return route;
    }

    private List<RoutePoint> nearestNeighborRoute(List<RoutePoint> points, CostMatrix matrix, RoutePoint startPoint) {
        List<RoutePoint> route = new ArrayList<>();
        Set<RoutePoint> unused = new HashSet<>(points);
        RoutePoint current = startPoint;

        while (!unused.isEmpty()) {
            RoutePoint next = null;
            int bestMinutes = Integer.MAX_VALUE;
            for (RoutePoint candidate : unused) {
                int minutes = matrix.minutes[matrix.indexOf(current)][matrix.indexOf(candidate)];
                if (minutes < bestMinutes) {
                    bestMinutes = minutes;
                    next = candidate;
                }
            }
            route.add(next);
            unused.remove(next);
            current = next;
        }

        return route;
    }

    private List<RoutePoint> improveWithTwoOpt(List<RoutePoint> route, CostMatrix matrix) {
        List<RoutePoint> best = new ArrayList<>(route);
        int bestMinutes = totalMinutes(best, matrix);
        boolean improved = true;

        while (improved) {
            improved = false;
            for (int left = 0; left < best.size() - 1; left++) {
                for (int right = left + 1; right < best.size(); right++) {
                    List<RoutePoint> candidate = twoOptSwap(best, left, right);
                    int candidateMinutes = totalMinutes(candidate, matrix);
                    if (candidateMinutes < bestMinutes) {
                        best = candidate;
                        bestMinutes = candidateMinutes;
                        improved = true;
                    }
                }
            }
        }

        return best;
    }

    private List<RoutePoint> improveSegmentWithTwoOpt(List<RoutePoint> route, RoutePoint start, RoutePoint end, CostMatrix matrix) {
        List<RoutePoint> best = new ArrayList<>(route);
        int bestMinutes = totalMinutesWithBounds(best, start, end, matrix);
        boolean improved = true;

        while (improved) {
            improved = false;
            for (int left = 0; left < best.size() - 1; left++) {
                for (int right = left + 1; right < best.size(); right++) {
                    List<RoutePoint> candidate = twoOptSwap(best, left, right);
                    int candidateMinutes = totalMinutesWithBounds(candidate, start, end, matrix);
                    if (candidateMinutes < bestMinutes) {
                        best = candidate;
                        bestMinutes = candidateMinutes;
                        improved = true;
                    }
                }
            }
        }

        return best;
    }

    private List<RoutePoint> twoOptSwap(List<RoutePoint> route, int left, int right) {
        List<RoutePoint> swapped = new ArrayList<>(route.size());
        swapped.addAll(route.subList(0, left));
        for (int i = right; i >= left; i--) {
            swapped.add(route.get(i));
        }
        swapped.addAll(route.subList(right + 1, route.size()));
        return swapped;
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

    private int totalMinutesWithBounds(List<RoutePoint> order, RoutePoint start, RoutePoint end, CostMatrix matrix) {
        int total = totalMinutes(order, matrix);
        if (start != null && !order.isEmpty()) {
            total += matrix.minutes[matrix.indexOf(start)][matrix.indexOf(order.get(0))];
        }
        if (end != null && !order.isEmpty()) {
            total += matrix.minutes[matrix.indexOf(order.get(order.size() - 1))][matrix.indexOf(end)];
        }
        if (start != null && end != null && order.isEmpty()) {
            total += matrix.minutes[matrix.indexOf(start)][matrix.indexOf(end)];
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

    private double roundKm(double value) {
        return Math.round(value * 100.0) / 100.0;
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
