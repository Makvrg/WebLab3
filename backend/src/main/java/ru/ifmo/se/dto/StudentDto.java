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

    @NotNull(message = "ISU ID не может быть пустым")
    @Min(value = 100000, message = "ISU ID должен содержать 6 цифр")
    @Max(value = 999999, message = "ISU ID должен содержать 6 цифр")
    private Integer isuId;

    @NotBlank(message = "ФИО не может быть пустым")
    @Size(min = 5, max = 100, message = "ФИО должно быть от 5 до 100 символов")
    @Pattern(regexp = "[А-Яа-яЁёA-Za-z0-9]+(?: [А-Яа-яЁёA-Za-z0-9]+)*", message = "Некорректный формат ФИО")
    private String fio;

    @NotBlank(message = "Группа не может быть пустой")
    @Pattern(regexp = "[A-Z][34][1-4]\\d{2}", message = "Группа должна быть в формате, например: P3224")
    private String stGroup;

    @NotNull(message = "Номер общежития не может быть пустым")
    @Min(value = 1, message = "Номер общежития не может быть меньше 1")
    @Max(value = 4, message = "Номер общежития не может быть больше 4")
    private Short dormitoryNumber;

    @NotNull(message = "Номер комнаты не может быть пустым")
    @Min(value = 100, message = "Номер комнаты не может быть меньше 100")
    @Max(value = 2000, message = "Номер комнаты не может быть больше 2000")
    private Short room;

    @NotNull(message = "Дата заселения обязательна")
    private LocalDate dateOfPlacement;

    @NotNull(message = "Флаг isNotRussian обязателен")
    private Boolean isNotRussian;

    @Size(max = 1000, message = "Заметки не должны превышать 1000 символов")
    private String notes;
}