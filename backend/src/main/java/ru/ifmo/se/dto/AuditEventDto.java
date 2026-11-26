package ru.ifmo.se.dto;

import jakarta.json.bind.annotation.JsonbNillable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonbNillable
public class AuditEventDto {

    private String eventId;
    private String timestamp;
    private String action;
    private String source;
    private AuditActorDto actor;
    private Integer isuId;
    private Map<String, Object> before;
    private Map<String, Object> after;
}
