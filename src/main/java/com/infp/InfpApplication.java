package com.infp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InfpApplication {

    public static void main(String[] args) {
        SpringApplication.run(InfpApplication.class, args);
    }

}
