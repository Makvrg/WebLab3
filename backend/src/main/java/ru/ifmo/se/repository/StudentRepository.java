package ru.ifmo.se.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.jooq.DSLContext;
import ru.ifmo.se.app_db.jooq.tables.records.StudentRecord;
import ru.ifmo.se.entity.Student;

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

    public List<Student> getStudents(int start, int end) {
        int limit = end - start;
        return dslContext
                .selectFrom(STUDENT)
                .where(STUDENT.IS_DELETED.isFalse())
                .orderBy(STUDENT.STUDENT_ID)
                .limit(limit)
                .offset(start)
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
