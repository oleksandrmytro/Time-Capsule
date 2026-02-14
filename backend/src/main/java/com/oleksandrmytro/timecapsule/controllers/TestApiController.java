package com.oleksandrmytro.timecapsule.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Simple test controller to verify the application is working.
 */
@RestController
@RequestMapping("/test")
public class TestApiController {

    @GetMapping("/public")
    public String publicEndpoint() {
        return "This is a public endpoint - no authentication required!";
    }

    @GetMapping("/protected")
    public String protectedEndpoint() {
        return "This is a protected endpoint - authentication required!";
    }
}
