package com.infp.plan.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class PlanRealtimeWebSocketConfig implements WebSocketConfigurer {

    private final PlanRealtimeWebSocketHandler handler;

    public PlanRealtimeWebSocketConfig(PlanRealtimeWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/plans/{planId}")
                .setAllowedOriginPatterns("*");
    }
}
