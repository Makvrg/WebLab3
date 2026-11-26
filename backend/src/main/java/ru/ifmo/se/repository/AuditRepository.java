package ru.ifmo.se.repository;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Table;
import org.jooq.impl.DSL;
import ru.ifmo.se.dto.AuditActorDto;
import ru.ifmo.se.dto.AuditEventDto;
import ru.ifmo.se.dto.AuditFilterDto;
import ru.ifmo.se.dto.AuditPageResponseDto;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class AuditRepository {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 15;
    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private static final Table<?> AUDIT_LOG = DSL.table("audit_log");
    private static final Field<UUID> EVENT_ID = DSL.field("event_id", UUID.class);
    private static final Field<OffsetDateTime> CREATED_AT = DSL.field("created_at", OffsetDateTime.class);
    private static final Field<String> ACTION = DSL.field("action", String.class);
    private static final Field<String> SOURCE = DSL.field("source", String.class);
    private static final Field<Integer> ACTOR_USER_ID = DSL.field("actor_user_id", Integer.class);
    private static final Field<String> ACTOR_LOGIN = DSL.field("actor_login", String.class);
    private static final Field<String> ACTOR_ROLE = DSL.field("actor_role", String.class);
    private static final Field<Integer> ISU_ID = DSL.field("isu_id", Integer.class);
    private static final Field<JSONB> BEFORE_STATE = DSL.field("before_state", JSONB.class);
    private static final Field<JSONB> AFTER_STATE = DSL.field("after_state", JSONB.class);

    private final DSLContext dslContext;
    private final Jsonb jsonb;

    @Inject
    public AuditRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
        this.jsonb = JsonbBuilder.create();
    }

    @PreDestroy
    void destroy() {
        if (jsonb != null) {
            try {
                jsonb.close();
            } catch (Exception ignored) {
            }
        }
    }

    public void save(
            UUID eventId,
            OffsetDateTime createdAt,
            String action,
            String source,
            Integer actorUserId,
            String actorLogin,
            String actorRole,
            Integer isuId,
            String beforeJson,
            String afterJson
    ) {
        OffsetDateTime effectiveCreatedAt = createdAt != null ? createdAt : OffsetDateTime.now(ZoneOffset.UTC);

        dslContext.insertInto(AUDIT_LOG)
                .columns(
                        EVENT_ID,
                        CREATED_AT,
                        ACTION,
                        SOURCE,
                        ACTOR_USER_ID,
                        ACTOR_LOGIN,
                        ACTOR_ROLE,
                        ISU_ID,
                        BEFORE_STATE,
                        AFTER_STATE
                )
                .values(
                        eventId,
                        effectiveCreatedAt,
                        action,
                        source,
                        actorUserId,
                        actorLogin,
                        actorRole,
                        isuId,
                        JSONB.jsonbOrNull(beforeJson),
                        JSONB.jsonbOrNull(afterJson)
                )
                .execute();
    }

    public AuditPageResponseDto findAuditLogs(AuditFilterDto filter) {
        Condition condition = buildFilterCondition(filter);

        int page = (filter != null && filter.getPage() != null && filter.getPage() >= DEFAULT_PAGE)
                ? filter.getPage()
                : DEFAULT_PAGE;
        int pageSize = (filter != null && filter.getPageSize() != null && filter.getPageSize() >= MIN_PAGE_SIZE)
                ? Math.min(MAX_PAGE_SIZE, filter.getPageSize())
                : DEFAULT_PAGE_SIZE;
        int offset = (page - 1) * pageSize;

        Long totalCount = dslContext.selectCount()
                .from(AUDIT_LOG)
                .where(condition)
                .fetchOne(0, Long.class);
        long total = totalCount != null ? totalCount : 0L;

        List<AuditEventDto> items = dslContext.select(
                        EVENT_ID,
                        CREATED_AT,
                        ACTION,
                        SOURCE,
                        ACTOR_USER_ID,
                        ACTOR_LOGIN,
                        ACTOR_ROLE,
                        ISU_ID,
                        BEFORE_STATE,
                        AFTER_STATE
                )
                .from(AUDIT_LOG)
                .where(condition)
                .orderBy(CREATED_AT.desc())
                .limit(pageSize)
                .offset(offset)
                .fetch(r -> {
                    UUID eventId = r.get(EVENT_ID);
                    OffsetDateTime createdAt = r.get(CREATED_AT);
                    String timestamp = createdAt != null ? createdAt.toInstant().toString() : null;

                    AuditActorDto actor = new AuditActorDto(
                            r.get(ACTOR_USER_ID),
                            r.get(ACTOR_LOGIN),
                            r.get(ACTOR_ROLE)
                    );

                    return new AuditEventDto(
                            eventId != null ? eventId.toString() : null,
                            timestamp,
                            r.get(ACTION),
                            r.get(SOURCE),
                            actor,
                            r.get(ISU_ID),
                            parseJsonMap(r.get(BEFORE_STATE)),
                            parseJsonMap(r.get(AFTER_STATE))
                    );
                });

        return new AuditPageResponseDto(items, total, page, pageSize);
    }

    private Condition buildFilterCondition(AuditFilterDto filter) {
        Condition condition = DSL.trueCondition();
        if (filter == null) {
            return condition;
        }

        if (filter.getAction() != null && !filter.getAction().isBlank()) {
            condition = condition.and(ACTION.eq(filter.getAction().trim()));
        }
        if (filter.getSource() != null && !filter.getSource().isBlank()) {
            condition = condition.and(SOURCE.eq(filter.getSource().trim()));
        }
        if (filter.getIsuId() != null) {
            condition = condition.and(ISU_ID.eq(filter.getIsuId()));
        }
        if (filter.getActorLogin() != null && !filter.getActorLogin().isBlank()) {
            condition = condition.and(ACTOR_LOGIN.containsIgnoreCase(filter.getActorLogin().trim()));
        }

        return condition;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonMap(JSONB state) {
        if (state == null || state.data() == null) {
            return null;
        }
        String raw = state.data().trim();
        if (raw.isEmpty() || "null".equals(raw)) {
            return null;
        }
        return (Map<String, Object>) jsonb.fromJson(raw, Map.class);
    }
}
