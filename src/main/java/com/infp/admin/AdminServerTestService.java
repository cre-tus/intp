package com.infp.admin;

import com.infp.admin.dto.ServerTestPoint;
import com.infp.admin.dto.ServerTestResponse;
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

    public ServerTestResponse run(int requestedNodeCount, int requestedUserCount) {
        int nodeCount = Math.max(2, Math.min(requestedNodeCount, 20));
        int userCount = Math.max(1, Math.min(requestedUserCount, 50));
        List<TransitStop> stops = gtfsTransitService.randomStops(nodeCount);
        List<RoutePoint> points = IntStream.range(0, stops.size())
                .mapToObj(index -> {
                    TransitStop stop = stops.get(index);
                    return new RoutePoint(
                            "gtfs:" + stop.stopId(),
                            stop.name(),
                            stop.lat(),
                            stop.lon(),
                            index,
                            "NONE",
                            null
                    );
                })
                .toList();
        List<ServerTestPoint> responsePoints = stops.stream()
                .map(stop -> new ServerTestPoint(stop.stopId(), stop.name(), stop.lat(), stop.lon()))
                .toList();

        long started = System.nanoTime();
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(userCount, 12));
        try {
            List<CompletableFuture<ServerTestUserResult>> futures = IntStream.rangeClosed(1, userCount)
                    .mapToObj(userIndex -> CompletableFuture.supplyAsync(
                            () -> runOne(userIndex, points),
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
                    successCount,
                    failureCount,
                    responsePoints,
                    results
            );
        } finally {
            executor.shutdownNow();
        }
    }

    private ServerTestUserResult runOne(int userIndex, List<RoutePoint> points) {
        try {
            RouteBenchmarkResponse benchmark = routeOptimizationService.optimizeBenchmark(points);
            return new ServerTestUserResult(
                    userIndex,
                    benchmark.withoutRedis().calculationMillis(),
                    benchmark.withRedis().calculationMillis(),
                    benchmark.redisCacheHit(),
                    benchmark.savedMillis(),
                    benchmark.speedupPercent(),
                    null
            );
        } catch (Exception exception) {
            return new ServerTestUserResult(userIndex, 0, 0, false, 0, 0, exception.getMessage());
        }
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
