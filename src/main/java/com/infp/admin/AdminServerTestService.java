package com.infp.admin;

import com.infp.admin.dto.ServerTestJobStartResponse;
import com.infp.admin.dto.ServerTestJobStatusResponse;
import com.infp.admin.dto.ServerTestPoint;
import com.infp.admin.dto.ServerTestResponse;
import com.infp.admin.dto.ServerTestShuffleResponse;
import com.infp.admin.dto.ServerTestShuffleJobStatusResponse;
import com.infp.admin.dto.ServerTestUserNodes;
import com.infp.admin.dto.ServerTestUserResult;
import com.infp.route.dto.RouteBenchmarkResponse;
import com.infp.route.dto.RoutePoint;
import com.infp.route.dto.TransitStop;
import com.infp.route.gtfs.GtfsTransitService;
import com.infp.route.service.RouteOptimizationService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

@Service
public class AdminServerTestService {
    private static final int MAX_NODE_COUNT = 20;
    private static final int MAX_USER_COUNT = 5000;
    private static final int MAX_RESULT_SAMPLE_COUNT = 500;

    private final GtfsTransitService gtfsTransitService;
    private final RouteOptimizationService routeOptimizationService;
    private final ExecutorService jobExecutor = Executors.newCachedThreadPool();
    private final Map<String, ServerTestJobStatusResponse> jobs = new ConcurrentHashMap<>();
    private final Map<String, ServerTestShuffleJobStatusResponse> shuffleJobs = new ConcurrentHashMap<>();

    public AdminServerTestService(
            GtfsTransitService gtfsTransitService,
            RouteOptimizationService routeOptimizationService
    ) {
        this.gtfsTransitService = gtfsTransitService;
        this.routeOptimizationService = routeOptimizationService;
    }

    public ServerTestShuffleResponse shuffle(int requestedNodeCount, int requestedUserCount) {
        int nodeCount = normalizeNodeCount(requestedNodeCount);
        int userCount = normalizeUserCount(requestedUserCount);
        return buildShuffle(nodeCount, userCount, null, null);
    }

    public ServerTestJobStartResponse startShuffleJob(int requestedNodeCount, int requestedUserCount) {
        int nodeCount = normalizeNodeCount(requestedNodeCount);
        int userCount = normalizeUserCount(requestedUserCount);
        String jobId = UUID.randomUUID().toString();
        shuffleJobs.put(jobId, new ServerTestShuffleJobStatusResponse(jobId, "RUNNING", 0, userCount, 0, null, null));
        jobExecutor.submit(() -> runShuffleJob(jobId, nodeCount, userCount));
        return new ServerTestJobStartResponse(jobId);
    }

    public ServerTestShuffleJobStatusResponse shuffleJobStatus(String jobId) {
        return shuffleJobs.get(jobId);
    }

    private void runShuffleJob(String jobId, int nodeCount, int userCount) {
        AtomicInteger completedUsers = new AtomicInteger(0);
        try {
            ServerTestShuffleResponse response = buildShuffle(nodeCount, userCount, jobId, completedUsers);
            shuffleJobs.put(jobId, new ServerTestShuffleJobStatusResponse(jobId, "COMPLETED", userCount, userCount, 100, response, null));
        } catch (Exception exception) {
            shuffleJobs.put(jobId, new ServerTestShuffleJobStatusResponse(jobId, "FAILED", completedUsers.get(), userCount, 100, null, exception.getMessage()));
        }
    }

    private ServerTestShuffleResponse buildShuffle(String jobId, int nodeCount, int userCount, AtomicInteger completedUsers) {
        return buildShuffle(nodeCount, userCount, jobId, completedUsers);
    }

    private ServerTestShuffleResponse buildShuffle(int nodeCount, int userCount, String jobId, AtomicInteger completedUsers) {
        List<ServerTestPoint> lodgingSeed = toServerTestPoints(gtfsTransitService.randomStops(nodeCount));
        ServerTestPoint lodging = lodgingSeed.get(0);
        int poolSize = Math.min(Math.max(nodeCount * Math.min(userCount, 500), nodeCount * 8), 10000);
        List<ServerTestPoint> pointPool = toServerTestPoints(gtfsTransitService.randomStopPool(poolSize));
        int reusableCount = Math.max(1, nodeCount / 3);
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(userCount, 32));
        try {
            List<CompletableFuture<ServerTestUserNodes>> futures = IntStream.rangeClosed(1, userCount)
                    .mapToObj(userIndex -> CompletableFuture
                            .supplyAsync(() -> buildUserShuffle(userIndex, lodging, lodgingSeed, pointPool, nodeCount, reusableCount), executor)
                            .thenApply(userNodes -> {
                                if (jobId != null && completedUsers != null) {
                                    int completed = completedUsers.incrementAndGet();
                                    int progress = Math.min(99, (int) Math.floor((completed * 100.0) / userCount));
                                    shuffleJobs.put(jobId, new ServerTestShuffleJobStatusResponse(jobId, "RUNNING", completed, userCount, progress, null, null));
                                }
                                return userNodes;
                            }))
                    .toList();
            List<ServerTestUserNodes> users = futures.stream()
                    .map(CompletableFuture::join)
                    .sorted(java.util.Comparator.comparingInt(ServerTestUserNodes::userIndex))
                    .toList();
            return new ServerTestShuffleResponse(nodeCount, userCount, users);
        } finally {
            executor.shutdownNow();
        }
    }

    private ServerTestUserNodes buildUserShuffle(
            int userIndex,
            ServerTestPoint lodging,
            List<ServerTestPoint> lodgingSeed,
            List<ServerTestPoint> pointPool,
            int nodeCount,
            int reusableCount
    ) {
        if (userIndex == 1) {
            return new ServerTestUserNodes(userIndex, lodgingSeed);
        }
        List<ServerTestPoint> points = new ArrayList<>();
        Set<String> used = new HashSet<>();
        addPoint(points, used, lodging);
        for (ServerTestPoint point : lodgingSeed) {
            if (points.size() >= reusableCount + 1 || points.size() >= nodeCount) break;
            addPoint(points, used, point);
        }
        int start = Math.floorMod(userIndex * Math.max(1, nodeCount - reusableCount), Math.max(1, pointPool.size()));
        int cursor = 0;
        while (points.size() < nodeCount && cursor < pointPool.size() * 2) {
            addPoint(points, used, pointPool.get((start + cursor) % pointPool.size()));
            cursor++;
        }
        while (points.size() < nodeCount) {
            for (ServerTestPoint point : toServerTestPoints(gtfsTransitService.randomStops(nodeCount))) {
                if (points.size() >= nodeCount) break;
                addPoint(points, used, point);
            }
        }
        return new ServerTestUserNodes(userIndex, List.copyOf(points));
    }

    public ServerTestResponse run(int requestedNodeCount, int requestedUserCount, List<ServerTestUserNodes> requestedUsers) {
        int nodeCount = normalizeNodeCount(requestedNodeCount);
        int userCount = normalizeUserCount(requestedUserCount);
        List<ServerTestUserNodes> users = normalizeUsers(requestedUsers, nodeCount, userCount);

        long started = System.nanoTime();
        List<ServerTestUserResult> results = users.stream()
                .map(this::runOne)
                .toList();
        return buildResponse(nodeCount, userCount, results, started);
    }

    public ServerTestJobStartResponse startJob(int requestedNodeCount, int requestedUserCount, List<ServerTestUserNodes> requestedUsers) {
        int nodeCount = normalizeNodeCount(requestedNodeCount);
        int userCount = normalizeUserCount(requestedUserCount);
        List<ServerTestUserNodes> users = normalizeUsers(requestedUsers, nodeCount, userCount);
        String jobId = UUID.randomUUID().toString();
        jobs.put(jobId, new ServerTestJobStatusResponse(jobId, "RUNNING", 0, userCount, 0, null, null));
        jobExecutor.submit(() -> runJob(jobId, nodeCount, userCount, users));
        return new ServerTestJobStartResponse(jobId);
    }

    public ServerTestJobStatusResponse jobStatus(String jobId) {
        return jobs.get(jobId);
    }

    private void runJob(String jobId, int nodeCount, int userCount, List<ServerTestUserNodes> users) {
        long started = System.nanoTime();
        List<ServerTestUserResult> results = java.util.Collections.synchronizedList(new ArrayList<>());
        AtomicInteger completedUsers = new AtomicInteger(0);
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(userCount, 32));
        try {
            List<CompletableFuture<Void>> futures = users.stream()
                    .map(user -> CompletableFuture
                            .supplyAsync(() -> runOne(user), executor)
                            .thenAccept(result -> {
                                results.add(result);
                                int completed = completedUsers.incrementAndGet();
                                int progress = Math.min(99, (int) Math.floor((completed * 100.0) / userCount));
                                jobs.put(jobId, new ServerTestJobStatusResponse(jobId, "RUNNING", completed, userCount, progress, null, null));
                            }))
                    .toList();
            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
            ServerTestResponse response = buildResponse(nodeCount, userCount, results, started);
            jobs.put(jobId, new ServerTestJobStatusResponse(jobId, "COMPLETED", userCount, userCount, 100, response, null));
        } catch (Exception exception) {
            jobs.put(jobId, new ServerTestJobStatusResponse(jobId, "FAILED", completedUsers.get(), userCount, 100, null, exception.getMessage()));
        } finally {
            executor.shutdownNow();
        }
    }

    private ServerTestResponse buildResponse(int nodeCount, int userCount, List<ServerTestUserResult> results, long startedNanos) {
        long wallClockMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
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
                "O(n^4) heuristic + O(n^2) GTFS cost extraction",
                "O(n^4) heuristic + reusable Redis nearest-stop/cost lookups",
                estimateWithoutRedisOperations(nodeCount),
                estimateWithRedisOperations(nodeCount),
                successCount,
                failureCount,
                results.stream()
                        .filter(result -> result.error() == null)
                        .findFirst()
                        .map(ServerTestUserResult::points)
                        .orElse(List.of()),
                sampleResults(results)
        );
    }

    private int normalizeNodeCount(int requestedNodeCount) {
        return Math.max(2, Math.min(requestedNodeCount, MAX_NODE_COUNT));
    }

    private int normalizeUserCount(int requestedUserCount) {
        return Math.max(1, Math.min(requestedUserCount, MAX_USER_COUNT));
    }

    private List<ServerTestUserResult> sampleResults(List<ServerTestUserResult> results) {
        if (results.size() <= MAX_RESULT_SAMPLE_COUNT) {
            return results;
        }
        List<ServerTestUserResult> sampled = new ArrayList<>(results);
        java.util.Collections.shuffle(sampled);
        return sampled.stream()
                .limit(MAX_RESULT_SAMPLE_COUNT)
                .toList();
    }

    private ServerTestUserResult runOne(ServerTestUserNodes userNodes) {
        List<ServerTestPoint> inputPoints = userNodes.points();
        List<RoutePoint> points = toRoutePointsFromServerTest(inputPoints);
        try {
            RouteBenchmarkResponse benchmark = routeOptimizationService.optimizeBenchmarkWithReusableRedis(points);
            return new ServerTestUserResult(
                    userNodes.userIndex(),
                    benchmark.estimatedWithoutRedisMillis(),
                    benchmark.estimatedWithRedisMillis(),
                    benchmark.redisCacheHit(),
                    benchmark.cacheHitCount(),
                    benchmark.cacheMissCount(),
                    "O(n^4) + O(n^2) GTFS cost extraction",
                    benchmark.redisCacheHit() ? "O(n^4) + Redis-reused GTFS costs" : "O(n^4) + cache misses",
                    estimateWithoutRedisOperations(points.size()),
                    benchmark.redisCacheHit() ? estimateWithRedisOperations(points.size()) : estimateWithoutRedisOperations(points.size()),
                    benchmark.savedMillis(),
                    benchmark.speedupPercent(),
                    inputPoints,
                    benchmark.withRedis().order().stream()
                            .map(point -> new ServerTestPoint(point.id(), point.name(), point.lat(), point.lon()))
                            .toList(),
                    null
            );
        } catch (Exception exception) {
            return new ServerTestUserResult(userNodes.userIndex(), 0, 0, false, 0, 0, "O(n^4)", "O(n^4)", 0, 0, 0, 0, inputPoints, List.of(), exception.getMessage());
        }
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
                    index == 0 ? "LODGING" : "NONE",
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

    private List<ServerTestPoint> buildReusableUserPoints(ServerTestPoint lodging, List<ServerTestPoint> previousPoints, int nodeCount) {
        List<ServerTestPoint> points = new ArrayList<>();
        Set<String> used = new HashSet<>();
        addPoint(points, used, lodging);

        int reusableCount = Math.max(1, nodeCount / 3);
        for (ServerTestPoint point : previousPoints) {
            if (points.size() >= reusableCount + 1 || points.size() >= nodeCount) break;
            addPoint(points, used, point);
        }

        while (points.size() < nodeCount) {
            for (ServerTestPoint point : toServerTestPoints(gtfsTransitService.randomStops(nodeCount))) {
                if (points.size() >= nodeCount) break;
                addPoint(points, used, point);
            }
        }

        return List.copyOf(points);
    }

    private void addPoint(List<ServerTestPoint> points, Set<String> used, ServerTestPoint point) {
        if (point == null) return;
        String key = point.id() + ":" + point.lat() + ":" + point.lon();
        if (used.add(key)) {
            points.add(point);
        }
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

    private long estimateWithoutRedisOperations(int nodeCount) {
        return estimateOptimizationOperations(nodeCount) + estimateCostExtractionOperations(nodeCount);
    }

    private long estimateWithRedisOperations(int nodeCount) {
        return estimateOptimizationOperations(nodeCount) + estimateRedisLookupOperations(nodeCount);
    }

    private long estimateOptimizationOperations(int nodeCount) {
        long n = Math.max(0, nodeCount);
        long matrix = n * n;
        long nearestNeighborComparisons = n * (n * (n - 1) / 2);
        long twoOptCandidates = n * (n * (n - 1) / 2) * Math.max(1, n - 1);
        return matrix + nearestNeighborComparisons + twoOptCandidates;
    }

    private long estimateCostExtractionOperations(int nodeCount) {
        long n = Math.max(0, nodeCount);
        return n + (n * Math.max(0, n - 1));
    }

    private long estimateRedisLookupOperations(int nodeCount) {
        long n = Math.max(0, nodeCount);
        return n + (n * Math.max(0, n - 1));
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
