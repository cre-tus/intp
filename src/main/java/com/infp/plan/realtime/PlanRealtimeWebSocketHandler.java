package com.infp.plan.realtime;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class PlanRealtimeWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, Set<WebSocketSession>> sessionsByPlanId = new ConcurrentHashMap<>();
    private final Map<String, String> latestMessageByPlanId = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        String planId = planId(session);
        sessionsByPlanId.computeIfAbsent(planId, ignored -> new CopyOnWriteArraySet<>()).add(session);
        String latest = latestMessageByPlanId.get(planId);
        if (latest != null && session.isOpen()) {
            session.sendMessage(new TextMessage(latest));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String planId = planId(session);
        if (isPlanUpdate(message.getPayload())) {
            latestMessageByPlanId.put(planId, message.getPayload());
        }
        for (WebSocketSession candidate : sessionsByPlanId.getOrDefault(planId, Set.of())) {
            if (candidate.isOpen() && !candidate.getId().equals(session.getId())) {
                candidate.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Set<WebSocketSession> sessions = sessionsByPlanId.get(planId(session));
        if (sessions == null) return;
        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByPlanId.remove(planId(session));
        }
    }

    private String planId(WebSocketSession session) {
        Object attribute = session.getAttributes().get("planId");
        if (attribute != null) return String.valueOf(attribute);
        URI uri = session.getUri();
        if (uri == null) return "default";
        String path = uri.getPath();
        int idx = path.lastIndexOf('/');
        return idx >= 0 && idx + 1 < path.length() ? path.substring(idx + 1) : "default";
    }

    private boolean isPlanUpdate(String payload) {
        return payload != null && payload.contains("\"PLAN_UPDATED\"");
    }
}
