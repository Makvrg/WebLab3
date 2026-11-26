package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuditFilterDto {

    private Integer page;
    private Integer pageSize;
    private String action;
    private String source;
    private Integer isuId;
    private String actorLogin;
}
