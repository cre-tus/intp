package com.infp.place.util;


public class Geo {

    public static double normalize(double value) {
        double scale = 10000.0;
        return Math.round(value * scale) / scale;
    }

    public static double normalize(String value) {
        return normalize(Double.parseDouble(value));
    }
}

