package ru.ifmo.se.weblab3.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jooq.DSLContext;
import ru.ifmo.se.app_db.jooq.tables.records.StudentRecord;
import ru.ifmo.se.weblab3.entity.Student;

import java.util.List;

import static ru.ifmo.se.app_db.jooq.tables.Student.STUDENT;

@ApplicationScoped
public class StudentRepository {

    private final DSLContext dslContext;

    @Inject
    public StudentRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
    }

    private Student parseDomainStudent(StudentRecord record) {
        return new Student(
                record.getIsuid(), record.getFio(),
                record.getGroup(), record.getDormitoryNumber(),
                record.getRoom(), record.getDateOfPlacement(),
                record.getIsNotRussian(), record.getNotes()
        );
    }

    public List<Student> getStudents() {
        return dslContext.selectFrom(STUDENT).fetch()
                .map(this::parseDomainStudent);
    }

    public void addStudent(Student student) {
        dslContext.insertInto(STUDENT)
                .set(STUDENT.ISUID, student.getIsuId())
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

    public boolean updateStudent(Student student) {
        int affectedRows = dslContext.update(STUDENT)
                .set(STUDENT.ISUID, student.getIsuId())
                .set(STUDENT.FIO, student.getFio())
                .set(STUDENT.GROUP, student.getGroup())
                .set(STUDENT.DORMITORY_NUMBER, student.getDormitoryNumber())
                .set(STUDENT.ROOM, student.getRoom())
                .set(STUDENT.DATE_OF_PLACEMENT, student.getDateOfPlacement())
                .set(STUDENT.IS_NOT_RUSSIAN, student.getIsNotRussian())
                .set(STUDENT.NOTES, student.getNotes())
                .where(STUDENT.ISUID.eq(student.getIsuId()),
                       STUDENT.IS_DELETED.eq(false))
                .execute();
        return affectedRows > 0;
    }

    public boolean deleteStudent(Integer isuId) {
        int affectedRows = dslContext.update(STUDENT)
                .set(STUDENT.IS_DELETED, true)
                .where(STUDENT.ISUID.eq(isuId),
                       STUDENT.IS_DELETED.eq(false))
                .execute();
        return affectedRows > 0;
    }
}






















