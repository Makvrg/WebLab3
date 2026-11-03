package ru.ifmo.se.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import ru.ifmo.se.app_db.jooq.tables.records.StudentRecord;
import ru.ifmo.se.dto.StudentFilterDto;
import ru.ifmo.se.entity.Student;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;

import static ru.ifmo.se.app_db.jooq.tables.Student.STUDENT;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class StudentRepository {

    private final DSLContext dslContext;

    @Inject
    public StudentRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
    }

    private Student parseDomainStudent(StudentRecord record) {
        return new Student(
                record.getIsuId(), record.getFio(),
                record.getGroup(), record.getDormitoryNumber(),
                record.getRoom(), record.getDateOfPlacement(),
                record.getIsNotRussian(), record.getNotes()
        );
    }

    public Optional<Student> getStudentByIsuId(Integer isuId) {
        return dslContext.selectFrom(STUDENT)
                .where(STUDENT.IS_DELETED.isFalse(),
                        STUDENT.ISU_ID.eq(isuId))
                .fetchOptional()
                .map(this::parseDomainStudent);
    }

    public boolean existsStudentByIsuId(Integer isuId) {
        return dslContext.fetchExists(
                dslContext.selectOne()
                        .from(STUDENT)
                        .where(STUDENT.ISU_ID.eq(isuId))
        );
    }

    public List<Student> getStudents(StudentFilterDto filters) {
        Condition condition = STUDENT.IS_DELETED.isFalse();

        if (filters != null) {
            if (filters.getIsuId() != null) {
                condition = condition.and(STUDENT.ISU_ID.eq(filters.getIsuId()));
            }
            if (filters.getFio() != null && !filters.getFio().isBlank()) {
                condition = condition.and(STUDENT.FIO.containsIgnoreCase(filters.getFio().trim()));
            }
            if (filters.getStGroup() != null && !filters.getStGroup().isBlank()) {
                condition = condition.and(STUDENT.GROUP.eq(filters.getStGroup().trim()));
            }
            if (filters.getDormitoryNumber() != null) {
                condition = condition.and(STUDENT.DORMITORY_NUMBER.eq(filters.getDormitoryNumber()));
            }
            if (filters.getRoom() != null) {
                condition = condition.and(STUDENT.ROOM.eq(filters.getRoom()));
            }
            if (filters.getDateOfPlacement() != null && !filters.getDateOfPlacement().isBlank()) {
                try {
                    LocalDate placementDate = LocalDate.parse(filters.getDateOfPlacement().trim());
                    condition = condition.and(STUDENT.DATE_OF_PLACEMENT.eq(placementDate));
                } catch (DateTimeParseException ignored) {
                }
            }
            if (filters.getIsNotRussian() != null) {
                condition = condition.and(STUDENT.IS_NOT_RUSSIAN.eq(filters.getIsNotRussian()));
            }
        }

        int pageNumber = (filters != null && filters.getPageNumber() != null && filters.getPageNumber() > 0)
                ? filters.getPageNumber() : 1;
        int pageSize = (filters != null && filters.getPageSize() != null && filters.getPageSize() > 0)
                ? filters.getPageSize() : 8;
        int offset = (pageNumber - 1) * pageSize;

        return dslContext
                .selectFrom(STUDENT)
                .where(condition)
                .orderBy(STUDENT.STUDENT_ID)
                .limit(pageSize)
                .offset(offset)
                .fetch()
                .map(this::parseDomainStudent);
    }

    public void addStudent(Student student) {
        dslContext.insertInto(STUDENT)
                .set(STUDENT.ISU_ID, student.getIsuId())
                .set(STUDENT.FIO, student.getFio())
                .set(STUDENT.GROUP, student.getGroup())
                .set(STUDENT.DORMITORY_NUMBER, student.getDormitoryNumber())
                .set(STUDENT.ROOM, student.getRoom())
                .set(STUDENT.DATE_OF_PLACEMENT, student.getDateOfPlacement())
                .set(STUDENT.IS_NOT_RUSSIAN, student.getIsNotRussian())
                .set(STUDENT.NOTES, student.getNotes())
                .set(STUDENT.IS_DELETED, false)
                .execute();
    }

    public boolean updateStudentByIsuId(Integer isuId, Student student) {
        int affectedRows = dslContext.update(STUDENT)
                .set(STUDENT.FIO, student.getFio())
                .set(STUDENT.GROUP, student.getGroup())
                .set(STUDENT.DORMITORY_NUMBER, student.getDormitoryNumber())
                .set(STUDENT.ROOM, student.getRoom())
                .set(STUDENT.DATE_OF_PLACEMENT, student.getDateOfPlacement())
                .set(STUDENT.IS_NOT_RUSSIAN, student.getIsNotRussian())
                .set(STUDENT.NOTES, student.getNotes())
                .where(STUDENT.ISU_ID.eq(isuId),
                        STUDENT.IS_DELETED.isFalse())
                .execute();
        return affectedRows > 0;
    }

    public boolean deleteStudentByIsuId(Integer isuId) {
        int affectedRows = dslContext.update(STUDENT)
                .set(STUDENT.IS_DELETED, true)
                .where(STUDENT.ISU_ID.eq(isuId),
                        STUDENT.IS_DELETED.isFalse())
                .execute();
        return affectedRows > 0;
    }
}
