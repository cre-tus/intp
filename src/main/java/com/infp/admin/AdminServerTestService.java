package com.infp.admin;

import com.infp.admin.dto.ServerTestPoint;
import com.infp.admin.dto.ServerTestResponse;
import com.infp.admin.dto.ServerTestShuffleResponse;
import com.infp.admin.dto.ServerTestUserNodes;
import com.infp.admin.dto.ServerTestUserResult;
import com.infp.route.dto.RouteBenchmarkResponse;
import com.infp.route.dto.RoutePoint;
import com.infp.route.dto.TransitStop;
import com.infp.route.gtfs.GtfsTransitService;
import com.infp.route.service.RouteOptimizationService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

@Service
public class AdminServerTestService {

    private final GtfsTransitService gtfsTransitService;
    private final RouteOptimizationService routeOptimizationService;

    public AdminServerTestService(
            GtfsTransitService gtfsTransitService,
            RouteOptimizationService routeOptimizationService
    ) {
        this.gtfsTransitService = gtfsTransitService;
        this.routeOptimizationService = routeOptimizationService;
    }

    public ServerTestShuffleResponse shuffle(int requestedNodeCount, int requestedUserCount) {
        int nodeCount = Math.max(2, Math.min(requestedNodeCount, 20));
        int userCount = Math.max(1, Math.min(requestedUserCount, 500));

        List<ServerTestUserNodes> users = IntStream.rangeClosed(1, userCount)
                .mapToObj(userIndex -> new ServerTestUserNodes(
                        userIndex,
                        toServerTestPoints(gtfsTransitService.randomStops(nodeCount))
                ))
                .toList();
        return new ServerTestShuffleResponse(nodeCount, userCount, users);
    }

    public ServerTestResponse run(int requestedNodeCount, int requestedUserCount, List<ServerTestUserNodes> requestedUsers) {
        int nodeCount = Math.max(2, Math.min(requestedNodeCount, 20));
        int userCount = Math.max(1, Math.min(requestedUserCount, 500));
        List<ServerTestUserNodes> users = normalizeUsers(requestedUsers, nodeCount, userCount);

        long started = System.nanoTime();
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(userCount, 32));
        try {
            List<CompletableFuture<ServerTestUserResult>> futures = users.stream()
                    .map(userNodes -> CompletableFuture.supplyAsync(
                            () -> runOne(userNodes),
                            executor
                    ))
                    .toList();
            List<ServerTestUserResult> results = futures.stream()
                    .map(CompletableFuture::join)
                    .toList();
            long wallClockMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            int successCount = (int) results.stream().filter(result -> result.error() == null).count();
            int failureCount = results.size() - successCount;
            double averageWithoutRedis = average(results.stream()
                    .filter(result -> result.error() == null)
                    .mapToLong(ServerTestUserResult::withoutRedisMillis)
                    .toArray());
            double averageWithRedis = average(results.stream()
                    .filter(result -> result.error() == null)
                    .mapToLong(ServerTestUserResult::withRedisMillis)
                    .toArray());

            return new ServerTestResponse(
                    nodeCount,
                    userCount,
                    wallClockMillis,
                    averageWithoutRedis,
                    averageWithRedis,
                    "Nearest Neighbor multi-start + 2-opt heuristic over GTFS transit cost matrix",
                    "O(n^4) worst-case heuristic estimate",
                    "O(1) Redis lookup on cache hit",
                    estimateOptimizationOperations(nodeCount),
                    1,
                    successCount,
                    failureCount,
                    results.stream()
                            .filter(result -> result.error() == null)
                            .findFirst()
                            .map(ServerTestUserResult::points)
                            .orElse(List.of()),
                    results
            );
        } finally {
            executor.shutdownNow();
        }
    }

    private ServerTestUserResult runOne(ServerTestUserNodes userNodes) {
        List<ServerTestPoint> inputPoints = userNodes.points();
        List<RoutePoint> points = toRoutePointsFromServerTest(inputPoints);
        try {
            RouteBenchmarkResponse initialBenchmark = routeOptimizationService.optimizeBenchmark(points);
            RouteBenchmarkResponse benchmark = ensureCacheHitBenchmark(points, initialBenchmark);
            return new ServerTestUserResult(
                    userNodes.userIndex(),
                    benchmark.withoutRedis().calculationMillis(),
                    benchmark.withRedis().calculationMillis(),
                    benchmark.redisCacheHit(),
                    "O(n^4)",
                    benchmark.redisCacheHit() ? "O(1)" : "O(n^4)",
                    estimateOptimizationOperations(points.size()),
                    benchmark.redisCacheHit() ? 1 : estimateOptimizationOperations(points.size()),
                    benchmark.savedMillis(),
                    benchmark.speedupPercent(),
                    inputPoints,
                    benchmark.withRedis().order().stream()
                            .map(point -> new ServerTestPoint(point.id(), point.name(), point.lat(), point.lon()))
                            .toList(),
                    null
            );
        } catch (Exception exception) {
            return new ServerTestUserResult(userNodes.userIndex(), 0, 0, false, "O(n^4)", "O(n^4)", 0, 0, 0, 0, inputPoints, List.of(), exception.getMessage());
        }
    }

    private RouteBenchmarkResponse ensureCacheHitBenchmark(List<RoutePoint> points, RouteBenchmarkResponse benchmark) {
        if (benchmark.redisCacheHit()) {
            return benchmark;
        }
        RouteBenchmarkResponse warmedBenchmark = routeOptimizationService.optimizeBenchmark(points);
        if (!warmedBenchmark.redisCacheHit()) {
            return benchmark;
        }
        long savedMillis = Math.max(0, benchmark.withoutRedis().calculationMillis() - warmedBenchmark.withRedis().calculationMillis());
        double speedupPercent = benchmark.withoutRedis().calculationMillis() == 0
                ? 0
                : Math.round((savedMillis * 1000.0 / benchmark.withoutRedis().calculationMillis())) / 10.0;
        return new RouteBenchmarkResponse(
                benchmark.withoutRedis(),
                warmedBenchmark.withRedis(),
                true,
                savedMillis,
                speedupPercent
        );
    }

    private List<RoutePoint> toRoutePointsFromServerTest(List<ServerTestPoint> points) {
        return IntStream.range(0, points.size())
                .mapToObj(index -> {
                    ServerTestPoint point = points.get(index);
                    return new RoutePoint(
                            blankToFallback(point.id(), "gtfs:server-test-" + index),
                            blankToFallback(point.name(), "Node " + (index + 1)),
                            point.lat(),
                            point.lon(),
                            index,
                            "NONE",
                            null
                    );
                })
                .toList();
    }

    private List<ServerTestPoint> toServerTestPoints(List<TransitStop> stops) {
        return stops.stream()
                .map(stop -> new ServerTestPoint(stop.stopId(), stop.name(), stop.lat(), stop.lon()))
                .toList();
    }

    private List<ServerTestUserNodes> normalizeUsers(List<ServerTestUserNodes> requestedUsers, int nodeCount, int userCount) {
        if (requestedUsers == null || requestedUsers.isEmpty()) {
            throw new IllegalArgumentException("노드 셔플을 먼저 실행해 주세요.");
        }
        List<ServerTestUserNodes> users = requestedUsers.stream()
                .limit(userCount)
                .map(userNodes -> new ServerTestUserNodes(
                        userNodes.userIndex(),
                        userNodes.points() == null ? List.of() : userNodes.points().stream()
                                .filter(this::isValidPoint)
                                .limit(nodeCount)
                                .toList()
                ))
                .filter(userNodes -> userNodes.points().size() == nodeCount)
                .toList();
        if (users.size() != userCount) {
            throw new IllegalArgumentException("셔플된 사용자/노드 수가 입력값과 맞지 않습니다. 노드 셔플을 다시 실행해 주세요.");
        }
        return users;
    }

    private boolean isValidPoint(ServerTestPoint point) {
        return point != null
                && Double.isFinite(point.lat())
                && Double.isFinite(point.lon())
                && point.lat() >= -90
                && point.lat() <= 90
                && point.lon() >= -180
                && point.lon() <= 180;
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private long estimateOptimizationOperations(int nodeCount) {
        long n = Math.max(0, nodeCount);
        long matrix = n * n;
        long nearestNeighborComparisons = n * (n * (n - 1) / 2);
        long twoOptCandidates = n * (n * (n - 1) / 2) * Math.max(1, n - 1);
        return matrix + nearestNeighborComparisons + twoOptCandidates;
    }

    private double average(long[] values) {
        if (values.length == 0) return 0;
        long total = 0;
        for (long value : values) {
            total += value;
        }
        return Math.round((total * 10.0 / values.length)) / 10.0;
    }
}
