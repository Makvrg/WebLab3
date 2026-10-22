FROM eclipse-temurin:21-jre

# Копируем локальный TomEE 11.0.0-M1 WebProfile
COPY tomee /usr/local/tomee

# Исправляем окончания строк Windows (CRLF -> LF)
RUN find /usr/local/tomee -type f -name "*.sh" \
    -exec sed -i 's/\r$//' {} +

# Выдаем права на исполнение shell-скриптов TomEE
RUN chmod +x /usr/local/tomee/bin/*.sh

# Удаляем стандартные приложения
RUN rm -rf /usr/local/tomee/webapps/*

# Копируем наше приложение
COPY target/WebLab3-1.0-SNAPSHOT.war /usr/local/tomee/webapps/ROOT.war

# TomEE внутри контейнера работает на 8080
EXPOSE 8080

# Запускаем TomEE
CMD ["/usr/local/tomee/bin/catalina.sh", "run"]