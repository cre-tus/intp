package com.infp.place.controller;

import com.infp.place.dto.PlaceItem;
import com.infp.place.service.PlaceAutocompleteService;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping("/api/place")
public class PlaceController {

    private final PlaceAutocompleteService service;

    public PlaceController(PlaceAutocompleteService service) {
        this.service = service;
    }

    @GetMapping("/autocomplete")
    public Mono<List<PlaceItem>> autocomplete(@RequestParam String q) {
        return service.autocomplete(q);
    }
}
