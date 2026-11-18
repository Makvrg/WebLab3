package ru.ifmo.se.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class OutboxRepository {

    public record OutboxMessage(UUID eventId, String payload) {}

    private final DSLContext dslContext;

    @Inject
    public OutboxRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
    }

    public void saveEvent(UUID eventId, String eventType, String jsonPayload) {
        dslContext.insertInto(DSL.table("outbox_event"))
                .columns(
                        DSL.field("event_id"),
                        DSL.field("event_type"),
                        DSL.field("payload")
                )
                .values(eventId, eventType, jsonPayload)
                .execute();
    }

    public List<OutboxMessage> findPendingEvents(int limit) {
        var eventIdField = DSL.field("event_id", UUID.class);
        var payloadField = DSL.field("payload", String.class);

        return dslContext.select(eventIdField, payloadField)
                .from(DSL.table("outbox_event"))
                .where(DSL.field("delivered_at").isNull())
                .orderBy(DSL.field("created_at").asc())
                .limit(limit)
                .fetch(r -> new OutboxMessage(r.get(eventIdField), r.get(payloadField)));
    }

    public void markDelivered(UUID eventId) {
        dslContext.update(DSL.table("outbox_event"))
                .set(DSL.field("delivered_at", OffsetDateTime.class), OffsetDateTime.now())
                .where(DSL.field("event_id", UUID.class).eq(eventId))
                .execute();
    }

    public void incrementRetry(UUID eventId) {
        dslContext.update(DSL.table("outbox_event"))
                .set(DSL.field("retry_count"), DSL.field("retry_count", Integer.class).plus(1))
                .where(DSL.field("event_id").eq(eventId))
                .execute();
    }
}
