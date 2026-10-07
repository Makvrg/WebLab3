package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StudentFilterDto {

    private Integer isuId;
    private String fio;
    private String stGroup;
    private Short dormitoryNumber;
    private Short room;
    private String dateOfPlacement;
    private Boolean isNotRussian;
    private Integer pageSize;
    private Integer pageNumber;
}
