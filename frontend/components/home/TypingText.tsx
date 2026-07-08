"use client";

import { useEffect, useState } from "react";

const TEXTS = [
    "장소를 담고, 날짜를 나누고, 친구와 바로 수정하세요.",
    "숙소부터 이동 동선까지 한 화면에서 정리하세요.",
    "초대 링크 하나로 같은 여행을 함께 준비합니다.",
];

export default function TypingText() {
    const [textIndex, setTextIndex] = useState(0);
    const [displayText, setDisplayText] = useState("");
    const [charIndex, setCharIndex] = useState(0);

    useEffect(() => {
        const currentText = TEXTS[textIndex];

        if (charIndex < currentText.length) {
            const typingTimer = window.setTimeout(() => {
                setDisplayText((prev) => prev + currentText[charIndex]);
                setCharIndex((prev) => prev + 1);
            }, 55);

            return () => window.clearTimeout(typingTimer);
        }

        const waitTimer = window.setTimeout(() => {
            setDisplayText("");
            setCharIndex(0);
            setTextIndex((prev) => (prev + 1) % TEXTS.length);
        }, 1800);

        return () => window.clearTimeout(waitTimer);
    }, [charIndex, textIndex]);

    return (
        <p className="home-muted mx-auto mt-6 min-h-[34px] max-w-2xl break-keep text-center text-lg leading-[1.5] sm:text-xl lg:mx-0 lg:text-left">
            {displayText}
            <span className="home-text ml-0.5 inline-block w-[1ch] animate-[blink_1s_step-start_infinite]">
                |
            </span>
        </p>
    );
}
