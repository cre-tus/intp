package com.infp.place.util;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class PlaceTextSimilarity {
    private static final int MAX_TEXT_LENGTH = 180;

    private PlaceTextSimilarity() {
    }

    public static double score(String left, String right) {
        String a = compact(left);
        String b = compact(right);
        if (a.isBlank() || b.isBlank()) return 0.0;
        if (a.equals(b)) return 1.0;

        double levenshtein = normalizedLevenshtein(a, b);
        double dice = diceCoefficient(a, b);
        double containment = a.contains(b) || b.contains(a)
                ? (double) Math.min(a.length(), b.length()) / Math.max(a.length(), b.length())
                : 0.0;
        double prefix = commonPrefixRatio(a, b);
        return Math.min(1.0, Math.max(Math.max(levenshtein, dice), Math.max(containment, prefix * 0.92)));
    }

    public static String compact(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]", "");
        return normalized.length() <= MAX_TEXT_LENGTH
                ? normalized
                : normalized.substring(0, MAX_TEXT_LENGTH);
    }

    public static String searchPrefix(String value, int maxLength) {
        if (value == null || maxLength <= 0) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]", "");
        return normalized.substring(0, Math.min(maxLength, normalized.length()));
    }

    private static double normalizedLevenshtein(String left, String right) {
        int[] previous = new int[right.length() + 1];
        int[] current = new int[right.length() + 1];
        for (int j = 0; j <= right.length(); j++) previous[j] = j;
        for (int i = 1; i <= left.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= right.length(); j++) {
                int substitution = previous[j - 1] + (left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1);
                current[j] = Math.min(Math.min(previous[j] + 1, current[j - 1] + 1), substitution);
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return 1.0 - ((double) previous[right.length()] / Math.max(left.length(), right.length()));
    }

    private static double diceCoefficient(String left, String right) {
        if (left.length() < 2 || right.length() < 2) return 0.0;
        Map<String, Integer> pairs = new HashMap<>();
        for (int i = 0; i < left.length() - 1; i++) {
            pairs.merge(left.substring(i, i + 2), 1, Integer::sum);
        }
        int overlap = 0;
        for (int i = 0; i < right.length() - 1; i++) {
            String pair = right.substring(i, i + 2);
            int remaining = pairs.getOrDefault(pair, 0);
            if (remaining <= 0) continue;
            overlap++;
            pairs.put(pair, remaining - 1);
        }
        return (2.0 * overlap) / ((left.length() - 1) + (right.length() - 1));
    }

    private static double commonPrefixRatio(String left, String right) {
        int max = Math.min(left.length(), right.length());
        int common = 0;
        while (common < max && left.charAt(common) == right.charAt(common)) common++;
        return (double) common / Math.max(left.length(), right.length());
    }
}
