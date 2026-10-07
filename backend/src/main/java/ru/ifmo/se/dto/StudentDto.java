package ru.ifmo.se.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StudentDto {

    @NotNull(message = "Поле isuId обязательно для заполнения")
    @Min(value = 100000, message = "Некорректный формат ИСУ. Ожидается 6 цифр.")
    @Max(value = 999999, message = "Некорректный формат ИСУ. Ожидается 6 цифр.")
    private Integer isuId;

    @NotBlank(message = "Поле fio обязательно для заполнения")
    @Size(min = 5, max = 100, message = "ФИО должно содержать минимум 5 символов и не более 100.")
    @Pattern(
            regexp = "[А-Яа-яЁёA-Za-z0-9]+(?: [А-Яа-яЁёA-Za-z0-9]+)*",
            message = "ФИО может содержать только буквы, цифры и пробелы."
    )
    @Pattern(
            regexp = ".*[А-Яа-яЁёA-Za-z].*",
            message = "ФИО должно содержать хотя бы одну букву."
    )
    private String fio;

    @NotBlank(message = "Поле stGroup обязательно для заполнения")
    @Pattern(regexp = "[A-Z][34][1-4]\\d{2}", message = "Некорректный формат группы.")
    private String stGroup;

    @NotNull(message = "Поле dormitoryNumber обязательно для заполнения")
    @Min(value = 1, message = "Номер общежития должен быть от 1 до 4.")
    @Max(value = 4, message = "Номер общежития должен быть от 1 до 4.")
    private Short dormitoryNumber;

    @NotNull(message = "Поле room обязательно для заполнения")
    @Min(value = 100, message = "Номер комнаты должен быть от 100 до 2000.")
    @Max(value = 2000, message = "Номер комнаты должен быть от 100 до 2000.")
    private Short room;

    @NotNull(message = "Поле dateOfPlacement обязательно для заполнения")
    private LocalDate dateOfPlacement;

    @NotNull(message = "Поле isNotRussian обязательно для заполнения")
    private Boolean isNotRussian;

    @Size(max = 1000, message = "Максимальное количество символов - 1000.")
    private String notes;
}