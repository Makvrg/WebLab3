package ru.ifmo.se.repository.initialization;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import liquibase.Liquibase;
import liquibase.changelog.ChangeSetStatus;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.LiquibaseException;
import liquibase.resource.ClassLoaderResourceAccessor;
import lombok.extern.java.Log;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;

@Log
@ApplicationScoped
public class DbMigrator {

    private static final String CHANGELOG_FILE = "changelog/db.changelog-master.xml";

    @Resource(lookup = "java:openejb/Resource/AppDataSource")
    private DataSource dataSource;

    public void onApplicationStarted(
            @Observes @Initialized(ApplicationScoped.class) Object event) {
        log.info("Запуск миграций базы данных");
        migrate();
        log.info("Инициализация базы данных завершена");
    }

    public void migrate() {
        try (Connection connection = dataSource.getConnection()) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));

            Liquibase liquibase = new Liquibase(
                    CHANGELOG_FILE,
                    new ClassLoaderResourceAccessor(),
                    database
            );

            log.info("Проверка состояния миграций");
            List<ChangeSetStatus> statuses = liquibase.getChangeSetStatuses(null, null);
            for (ChangeSetStatus status : statuses) {
                log.info(String.format(
                        "ChangeSet: %s | Автор: %s | Описание: %s | Статус: %s | ID: %s",
                        status.getChangeSet().getId(),
                        status.getChangeSet().getAuthor(),
                        status.getChangeSet().getDescription(),
                        status.getWillRun() ? "NOT APPLIED" : "APPLIED",
                        status.getChangeSet().getChangeLog()
                ));
            }

            liquibase.update("");
            log.info("Миграции успешно применены");
        } catch (LiquibaseException e) {
            log.log(
                    Level.SEVERE,
                    "Ошибка при выполнении миграций: " + e.getMessage(), e);
            throw new IllegalStateException("Не удалось применить миграции", e);
        } catch (SQLException e) {
            log.log(
                    Level.SEVERE,
                    "Ошибка при получении соединения с БД: " + e.getMessage(), e);
            throw new IllegalStateException("Не удалось получить соединение с БД", e);
        }
    }
}
