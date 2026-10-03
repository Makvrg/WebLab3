package ru.ifmo.se.weblab3.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@AllArgsConstructor
public class Student {

    private Integer isuId;
    private String fio;
    private String group;
    private Short dormitoryNumber;
    private Short room;
    private LocalDate dateOfPlacement;
    private Boolean isNotRussian;
    private String notes;

    @Override
    public String toString() {
        return "Student{" +
                "isuId=" + isuId +
                ", fio='" + fio + '\'' +
                ", group='" + group + '\'' +
                ", dormitoryNumber=" + dormitoryNumber +
                ", room=" + room +
                ", dateOfPlacement=" + dateOfPlacement +
                ", isNotRussian=" + isNotRussian +
                ", notes='" + notes + '\'' +
                '}';
    }
}
