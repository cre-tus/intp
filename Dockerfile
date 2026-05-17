FROM gradle:8.14-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle clean bootJar -x test

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
COPY --from=build /app/db/gtfs ./db/gtfs
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
