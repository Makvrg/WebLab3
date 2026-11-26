package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuditPageResponseDto {

    private List<AuditEventDto> items;
    private long total;
    private int page;
    private int pageSize;
}
