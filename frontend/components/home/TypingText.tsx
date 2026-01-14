"use client";

import { useEffect, useState } from "react";

const TEXTS = ["푸드 트립", "인기 있는 여행지", "나만의 여행 계획", "서현우 화이팅"];

export default function TypingText() {
    const [textIndex, setTextIndex] = useState(0);
    const [displayText, setDisplayText] = useState("");
    const [charIndex, setCharIndex] = useState(0);

    useEffect(() => {
        const currentText = TEXTS[textIndex];

        if (charIndex < currentText.length) {
            const typingTimer = setTimeout(() => {
                setDisplayText((prev) => prev + currentText[charIndex]);
                setCharIndex((prev) => prev + 1);
            }, 80);

            return () => clearTimeout(typingTimer);
        }

        const waitTimer = setTimeout(() => {
            setDisplayText("");
            setCharIndex(0);
            setTextIndex((prev) => (prev + 1) % TEXTS.length);
        }, 2000);

        return () => clearTimeout(waitTimer);
    }, [charIndex, textIndex]);

    return (
        <p className="text-center text-[24px] text-[rgba(0,0,0,0.55)] leading-[1.45]">
            {displayText}
            <span className="inline-block w-[1ch] animate-[blink_1s_step-start_infinite]">
        |
      </span>
        </p>
    );
}
