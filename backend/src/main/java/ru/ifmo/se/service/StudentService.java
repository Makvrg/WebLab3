package ru.ifmo.se.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import ru.ifmo.se.dto.StudentDto;
import ru.ifmo.se.dto.StudentFilterDto;
import ru.ifmo.se.entity.Student;
import ru.ifmo.se.exceptions.NotFoundException;
import ru.ifmo.se.exceptions.NotUniqueIdException;
import ru.ifmo.se.exceptions.ValidationException;
import ru.ifmo.se.repository.StudentRepository;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class StudentService {

    private final StudentRepository repo;
    private final Validator validator;

    @Inject
    public StudentService(StudentRepository repo, Validator validator) {
        this.repo = repo;
        this.validator = validator;
    }

    private void validateStudentData(StudentDto data) {
        if (data == null) {
            throw new ValidationException("Данные студента отсутствуют");
        }

        Set<ConstraintViolation<StudentDto>> violations = validator.validate(data);
        if (!violations.isEmpty()) {
            String errorMessage = violations.stream()
                    .map(ConstraintViolation::getMessage)
                    .collect(Collectors.joining("; "));
            throw new ValidationException(errorMessage);
        }
    }

    private StudentDto toDto(Student student) {
        return new StudentDto(
                student.getIsuId(),
                student.getFio(),
                student.getGroup(),
                student.getDormitoryNumber(),
                student.getRoom(),
                student.getDateOfPlacement(),
                student.getIsNotRussian(),
                student.getNotes()
        );
    }

    private Student toEntity(StudentDto dto) {
        return new Student(
                dto.getIsuId(),
                dto.getFio().trim(),
                dto.getStGroup(),
                dto.getDormitoryNumber(),
                dto.getRoom(),
                dto.getDateOfPlacement(),
                dto.getIsNotRussian(),
                dto.getNotes() != null ? dto.getNotes() : ""
        );
    }

    public List<StudentDto> getStudents(StudentFilterDto filters) {
        // TODO Валидация данных пагинации
        List<Student> students = repo.getStudents(
                (filters.getPageNumber() - 1) * filters.getPageSize(),
                filters.getPageSize() * filters.getPageNumber()
        );

        if (filters == null) {
            return students.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
        }

        return students.stream()
                // Поиск по ИСУ
                .filter(s -> filters.getIsuId() == null
                        || s.getIsuId().equals(filters.getIsuId()))
                // Поиск по ФИО
                .filter(s -> filters.getFio() == null || filters.getFio().isBlank()
                        || s.getFio().toLowerCase().contains(filters.getFio().toLowerCase()))
                // Фильтр по группе
                .filter(s -> filters.getStGroup() == null || filters.getStGroup().isBlank()
                        || s.getGroup().equals(filters.getStGroup()))
                // Фильтр по номеру общежития
                .filter(s -> filters.getDormitoryNumber() == null
                        || s.getDormitoryNumber().equals(filters.getDormitoryNumber()))
                // Фильтр по номеру комнаты
                .filter(s -> filters.getRoom() == null
                        || s.getRoom().equals(filters.getRoom()))
                // Фильтр по дате заселения (формат "YYYY-MM-DD")
                .filter(s -> filters.getDateOfPlacement() == null || filters.getDateOfPlacement().isBlank()
                        || s.getDateOfPlacement().toString().equals(filters.getDateOfPlacement()))
                // Фильтр по статусу иностранца
                .filter(s -> filters.getIsNotRussian() == null
                        || s.getIsNotRussian().equals(filters.getIsNotRussian()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<StudentDto> queryStudents(StudentFilterDto queryData) {
        return getStudents(queryData);
    }

    public StudentDto getStudent(Integer isuId) {
        Student student = repo.getStudentByIsuId(isuId)
                .orElseThrow(() -> new NotFoundException("Студент с ИСУ " + isuId + " не найден."));
        return toDto(student);
    }

    public StudentDto createStudent(StudentDto data) {
        validateStudentData(data);

        if (repo.existsStudentByIsuId(data.getIsuId())) {
            throw new NotUniqueIdException("Student with this ISU_ID already exists");
        }

        Student newStudent = toEntity(data);
        repo.addStudent(newStudent);
        return toDto(newStudent);
    }

    public StudentDto updateStudent(Integer isuId, StudentDto data) {
        if (data == null) {
            throw new ValidationException("Данные студента отсутствуют");
        }
        data.setIsuId(isuId);
        validateStudentData(data);

        Student updatedStudent = toEntity(data);

        if (!repo.updateStudentByIsuId(isuId, updatedStudent)) {
            throw new NotFoundException("Студент с ИСУ " + isuId + " не найден.");
        }

        return toDto(updatedStudent);
    }

    public void deleteStudent(Integer isuId) {
        if (!repo.deleteStudentByIsuId(isuId)) {
            throw new NotFoundException("Студент с ИСУ " + isuId + " не найден.");
        }
    }
}