package ru.ifmo.se.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
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
import ru.ifmo.se.repository.OutboxRepository;
import ru.ifmo.se.repository.StudentRepository;
import ru.ifmo.se.security.UserPrincipal;

import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class StudentService {

    private final StudentRepository studentRepository;
    private final OutboxRepository outboxRepository;
    private final Validator validator;

    @Inject
    public StudentService(StudentRepository studentRepository,
                          Validator validator,
                          OutboxRepository outboxRepository) {
        this.studentRepository = studentRepository;
        this.validator = validator;
        this.outboxRepository = outboxRepository;
    }

    private void recordAuditEvent(
            String action,
            String source,
            UserPrincipal actor,
            Object isuId,
            Object beforeState,
            Object afterState
    ) {
        UUID eventId = UUID.randomUUID();

        Map<String, Object> actorMap = new LinkedHashMap<>();
        if (actor != null) {
            actorMap.put("userId", actor.getUserId());
            actorMap.put("login", actor.getName());
            actorMap.put("role", actor.getRole());
        }

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", eventId.toString());
        event.put("timestamp", java.time.Instant.now().toString());
        event.put("action", action);
        event.put("source", source);
        event.put("actor", actorMap);
        event.put("isuId", isuId);
        event.put("before", beforeState);
        event.put("after", afterState);

        try (jakarta.json.bind.Jsonb jsonb = jakarta.json.bind.JsonbBuilder.create()) {
            String jsonPayload = jsonb.toJson(event);
            outboxRepository.saveEvent(eventId, action, jsonPayload);
        } catch (Exception e) {
            throw new RuntimeException("Не удалось сформировать событие аудита", e);
        }
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

    @Transactional
    public List<StudentDto> getStudents(StudentFilterDto filters) {
        return studentRepository.getStudents(filters).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<StudentDto> queryStudents(StudentFilterDto queryData) {
        return getStudents(queryData);
    }

    @Transactional
    public StudentDto getStudent(Integer isuId) {
        Student student = studentRepository.getStudentByIsuId(isuId)
                .orElseThrow(() -> new NotFoundException("Студент с ИСУ " + isuId + " не найден."));
        return toDto(student);
    }

    @Transactional
    public StudentDto createStudent(
            StudentDto data,
            UserPrincipal actor,
            String source
    ) {
        validateStudentData(data);

        if (studentRepository.existsStudentByIsuId(data.getIsuId())) {
            throw new NotUniqueIdException("Student with this ISU_ID already exists");
        }

        Student newStudent = toEntity(data);
        studentRepository.addStudent(newStudent);
        recordAuditEvent("CREATE", source, actor,
                newStudent.getIsuId(), null, newStudent);
        return toDto(newStudent);
    }

    @Transactional
    public StudentDto updateStudent(
            Integer isuId, StudentDto data,
            UserPrincipal actor, String source
    ) {
        if (data == null) {
            throw new ValidationException("Данные студента отсутствуют");
        }
        data.setIsuId(isuId);
        validateStudentData(data);

        Student updatedStudent = toEntity(data);

        StudentDto before = getStudent(isuId);
        Student after = updatedStudent;

        if (!studentRepository.updateStudentByIsuId(isuId, updatedStudent)) {
            throw new NotFoundException("Студент с ИСУ " + isuId + " не найден.");
        }
        recordAuditEvent("UPDATE", source, actor, isuId, before, after);

        return toDto(updatedStudent);
    }

    @Transactional
    public void deleteStudent(
            Integer isuId,
            UserPrincipal actor,
            String source
    ) {
        StudentDto before = getStudent(isuId);

        if (!studentRepository.deleteStudentByIsuId(isuId)) {
            throw new NotFoundException("Студент с ИСУ " + isuId + " не найден.");
        }
        recordAuditEvent("DELETE", source, actor, isuId, before, null);
    }
}
