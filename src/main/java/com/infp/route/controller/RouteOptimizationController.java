package com.infp.route.controller;

import com.infp.route.dto.RouteCompareRequest;
import com.infp.route.dto.RouteCompareResponse;
import com.infp.route.dto.RouteBenchmarkResponse;
import com.infp.route.dto.RouteCostMatrixResponse;
import com.infp.route.dto.RouteOptimizeRequest;
import com.infp.route.dto.RouteOptimizationResponse;
import com.infp.route.dto.TransitStopsResponse;
import com.infp.route.service.RouteOptimizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/routes")
public class RouteOptimizationController {

    private final RouteOptimizationService routeOptimizationService;

    public RouteOptimizationController(RouteOptimizationService routeOptimizationService) {
        this.routeOptimizationService = routeOptimizationService;
    }

    @PostMapping("/optimize")
    public ResponseEntity<RouteOptimizationResponse> optimize(@RequestBody RouteOptimizeRequest request) {
        return ResponseEntity.ok(routeOptimizationService.optimize(request.points()));
    }

    @PostMapping("/optimize/benchmark")
    public ResponseEntity<RouteBenchmarkResponse> optimizeBenchmark(@RequestBody RouteOptimizeRequest request) {
        return ResponseEntity.ok(routeOptimizationService.optimizeBenchmark(request.points()));
    }

    @PostMapping("/compare")
    public ResponseEntity<RouteCompareResponse> compare(@RequestBody RouteCompareRequest request) {
        return ResponseEntity.ok(routeOptimizationService.compare(request.manualOrder()));
    }

    @PostMapping("/cost-matrix")
    public ResponseEntity<RouteCostMatrixResponse> costMatrix(@RequestBody RouteOptimizeRequest request) {
        return ResponseEntity.ok(routeOptimizationService.costMatrix(request.points()));
    }

    @GetMapping("/stops/nearby")
    public ResponseEntity<TransitStopsResponse> nearbyStops(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "800") int radiusMeters,
            @RequestParam(defaultValue = "8") int limit
    ) {
        return ResponseEntity.ok(new TransitStopsResponse(
                lat,
                lon,
                radiusMeters,
                routeOptimizationService.nearbyStops(lat, lon, radiusMeters, limit)
        ));
    }
}
