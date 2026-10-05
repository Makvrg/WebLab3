package ru.ifmo.se.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jooq.DSLContext;
import ru.ifmo.se.app_db.jooq.tables.records.UserRecord;
import ru.ifmo.se.entity.Role;
import ru.ifmo.se.entity.User;

import java.util.List;
import java.util.Optional;

import static ru.ifmo.se.app_db.jooq.tables.User.USER;

@ApplicationScoped
public class UserRepository {

    private final DSLContext dslContext;

    @Inject
    public UserRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
    }

    private User parseDomainUser(UserRecord record) {
        return new User(
                record.getLogin(), record.getEmail(),
                Role.valueOf(record.getRole()), record.getHashedPassword(),
                record.getSalt()
        );
    }

    public Optional<User> getUserByLogin(String login) {
        return dslContext.selectFrom(USER)
                .where(USER.IS_DELETED.isFalse(),
                       USER.LOGIN.eq(login))
                .fetchOptional()
                .map(this::parseDomainUser);
    }

    public boolean existsUserByLogin(String login) {
        return dslContext.fetchExists(
                dslContext.selectOne()
                        .from(USER)
                        .where(USER.IS_DELETED.isFalse(),
                               USER.LOGIN.eq(login))
        );
    }

    public List<User> getUsers() {
        return dslContext.selectFrom(USER)
                .where(USER.IS_DELETED.isFalse())
                .fetch()
                .map(this::parseDomainUser);
    }

    public void addUser(User user) {
        dslContext.insertInto(USER)
                .set(USER.LOGIN, user.getLogin())
                .set(USER.EMAIL, user.getEmail())
                .set(USER.ROLE, user.getRole().name())
                .set(USER.HASHED_PASSWORD, user.getHashedPassword())
                .set(USER.SALT, user.getSalt())
                .set(USER.IS_DELETED, false)
                .execute();
    }

    public boolean updateUser(User user) {
        int affectedRows = dslContext.update(USER)
                .set(USER.EMAIL, user.getEmail())
                .set(USER.ROLE, user.getRole().name())
                .set(USER.HASHED_PASSWORD, user.getHashedPassword())
                .set(USER.SALT, user.getSalt())
                .where(USER.LOGIN.eq(user.getLogin()),
                       USER.IS_DELETED.eq(false))
                .execute();
        return affectedRows > 0;
    }

    public boolean deleteUser(String login) {
        int affectedRows = dslContext.update(USER)
                .set(USER.IS_DELETED, true)
                .where(USER.LOGIN.eq(login),
                       USER.IS_DELETED.eq(false))
                .execute();
        return affectedRows > 0;
    }
}
