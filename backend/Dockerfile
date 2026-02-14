#####################################################################
# 1️⃣  DEV‑СТАДИЯ — live‑reload через spring-boot:run
#####################################################################
FROM maven:3.9-eclipse-temurin-21-alpine AS dev
WORKDIR /app

# 1. кешируем зависимости
COPY pom.xml .mvn/ ./
RUN mvn -q dependency:go-offline

# 2. исходники смонтируются томом
COPY src ./src

# 3. запускаем «горячий» Spring
 # 35729 = LiveReload
EXPOSE 8080 35729                     
CMD ["mvn","-q","spring-boot:run","-Dspring-boot.run.fork=false"]

#####################################################################
# 2️⃣  BUILD‑СТАДИЯ — собираем JAR
#####################################################################
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build
COPY pom.xml ./
COPY .mvn .mvn
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

#####################################################################
# 3️⃣  RUNTIME‑СТАДИЯ — минимальный JRE для прод
#####################################################################
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
ENV JAVA_OPTS="-Xms128m -Xmx512m"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
HEALTHCHECK CMD wget -qO- http://localhost:8080/actuator/health || exit 1
