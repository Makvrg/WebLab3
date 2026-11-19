package ru.ifmo.se.scheduler;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.java.Log;
import ru.ifmo.se.repository.OutboxRepository;
import ru.ifmo.se.repository.OutboxRepository.OutboxMessage;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
@Log
public class OutboxRelayScheduler {

    private final OutboxRepository outboxRepository;
    private final HttpClient httpClient;
    private final ScheduledExecutorService scheduler;
    private final String nodeUrl;
    private final String internalSecret;

    @Inject
    public OutboxRelayScheduler(OutboxRepository outboxRepository) {
        this.outboxRepository = outboxRepository;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "outbox-relay-worker");
            thread.setDaemon(true);
            return thread;
        });
        String rawNodeUrl = System.getenv("NODE_BACKEND_URL");
        this.nodeUrl = (rawNodeUrl == null || rawNodeUrl.isBlank())
                ? "http://node-backend:4000"
                : rawNodeUrl.trim().replaceAll("/+$", "");
        this.internalSecret = System.getenv("INTERNAL_API_SECRET");
    }

    public void onStartup(@Observes @Initialized(ApplicationScoped.class) Object init) {
        log.info("OutboxRelayScheduler запущен: проверка исходящих событий каждые 2 секунды");
        scheduler.scheduleWithFixedDelay(this::relayPendingEvents, 2, 2, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void onShutdown() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    public void relayPendingEvents() {
        try {
            var pendingEvents = outboxRepository.findPendingEvents(50);

            for (OutboxMessage event : pendingEvents) {
                sendEvent(event);
            }
        } catch (Exception e) {
            log.log(Level.WARNING, "Ошибка при опросе таблицы outbox_event", e);
        }
    }

    private void sendEvent(OutboxMessage event) {
        int statusCode;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(nodeUrl + "/internal/events"))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Secret", internalSecret != null ? internalSecret : "")
                    .POST(HttpRequest.BodyPublishers.ofString(event.payload()))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );
            statusCode = response.statusCode();
        } catch (Exception e) {
            log.log(Level.WARNING, "Сетевая ошибка при отправке события " + event.eventId(), e);
            outboxRepository.incrementRetry(event.eventId());
            return;
        }

        if (statusCode == 200) {
            outboxRepository.markDelivered(event.eventId());
        } else {
            log.warning("Node.js вернул статус " + statusCode + " для события " + event.eventId());
            outboxRepository.incrementRetry(event.eventId());
        }
    }
}
