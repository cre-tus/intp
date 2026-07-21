"use client";

import { useEffect, useRef, useState } from "react";

export default function MovingRow({ children }: { children: React.ReactNode }) {
    const rowRef = useRef<HTMLDivElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [focusX, setFocusX] = useState(0);

    useEffect(() => {
        const focusCity = (event: Event) => {
            const city = (event as CustomEvent<{ city?: string }>).detail?.city;
            if (!city || !rowRef.current || !wrapRef.current) return;

            const cards = Array.from(
                rowRef.current.querySelectorAll<HTMLElement>(`[data-city-card="${city}"]`),
            );
            if (cards.length === 0) return;

            const rowRect = rowRef.current.getBoundingClientRect();
            const rowCenter = rowRect.left + rowRect.width / 2;
            const visibleCard = cards.reduce((nearest, card) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const nearestRect = nearest.getBoundingClientRect();
                const nearestCenter = nearestRect.left + nearestRect.width / 2;
                return Math.abs(cardCenter - rowCenter) < Math.abs(nearestCenter - rowCenter) ? card : nearest;
            });

            const transform = getComputedStyle(wrapRef.current).transform;
            const currentX = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
            const cardRect = visibleCard.getBoundingClientRect();
            const cardCenterWithoutTransform = cardRect.left + cardRect.width / 2 - currentX;

            setFocusX(rowCenter - cardCenterWithoutTransform);
            setFocused(true);
        };
        const clearFocusCity = () => {
            setFocused(false);
            setFocusX(0);
        };

        window.addEventListener("home:focus-city", focusCity);
        window.addEventListener("home:clear-focus-city", clearFocusCity);
        return () => {
            window.removeEventListener("home:focus-city", focusCity);
            window.removeEventListener("home:clear-focus-city", clearFocusCity);
        };
    }, []);

    return (
        <div ref={rowRef} className={`moving-row relative mt-6 w-full overflow-hidden pb-4 ${focused ? "is-focused" : ""}`}>
            <div className="home-fade-left pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-24" />
            <div className="home-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-24" />
            <div
                ref={wrapRef}
                className="moving-wrap flex w-max"
                style={{ "--moving-focus-x": `${focusX}px` } as React.CSSProperties}
            >
                <div className="moving-track flex gap-6">
                    {children}
                    <div className="w-6 shrink-0" aria-hidden />
                </div>

                <div className="moving-track flex gap-6" aria-hidden>
                    {children}
                    <div className="w-6 shrink-0" aria-hidden />
                </div>
            </div>
        </div>
    );
}
