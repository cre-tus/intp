package com.infp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.annotation.AnnotatedElementUtils;

import static org.junit.jupiter.api.Assertions.assertTrue;

class InfpApplicationTests {

    @Test
    void applicationEntryPointIsConfigured() {
        assertTrue(AnnotatedElementUtils.hasAnnotation(InfpApplication.class, SpringBootApplication.class));
    }
}
