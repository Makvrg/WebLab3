package ru.ifmo.se.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import ru.ifmo.se.dto.AuditFilterDto;
import ru.ifmo.se.dto.AuditPageResponseDto;
import ru.ifmo.se.repository.AuditRepository;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class AuditService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 15;
    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private final AuditRepository auditRepository;

    @Inject
    public AuditService(AuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    public AuditPageResponseDto getAuditLogs(AuditFilterDto filter) {
        int rawPage = (filter != null && filter.getPage() != null)
                ? filter.getPage()
                : DEFAULT_PAGE;
        int rawPageSize = (filter != null && filter.getPageSize() != null)
                ? filter.getPageSize()
                : DEFAULT_PAGE_SIZE;

        int normalizedPage = Math.max(DEFAULT_PAGE, rawPage);
        int normalizedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, rawPageSize));

        AuditFilterDto normalizedFilter = new AuditFilterDto(
                normalizedPage,
                normalizedPageSize,
                filter != null ? filter.getAction() : null,
                filter != null ? filter.getSource() : null,
                filter != null ? filter.getIsuId() : null,
                filter != null ? filter.getActorLogin() : null
        );

        return auditRepository.findAuditLogs(normalizedFilter);
    }
}
