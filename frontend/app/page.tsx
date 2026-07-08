import HeroSection from "@/components/home/HeroSection";
import Header from "@/app/header";
import type { CSSProperties } from "react";

export default function Home() {
    return (
        <main>
            <Header />
            <div className="home-surface relative">
                <AdSlot side="left" />
                <AdSlot side="right" />
                <HeroSection />
            </div>
        </main>
    );
}

function AdSlot({ side }: { side: "left" | "right" }) {
    const isLeft = side === "left";
    const offset = "max(48px, calc((100vw - 1280px) / 2 - 170px))";
    const positionStyle: CSSProperties = isLeft ? { left: offset } : { right: offset };

    return (
        <aside
            className="home-card pointer-events-none fixed top-1/2 z-20 hidden h-[70vh] max-h-[760px] min-h-[560px] w-[120px] -translate-y-1/2 rounded-xl border border-dashed p-3 text-center text-xs font-semibold shadow-sm backdrop-blur xl:block 2xl:w-[150px]"
            style={positionStyle}
            aria-label={`${isLeft ? "왼쪽" : "오른쪽"} 광고 배너 영역`}
        >
            <div className="home-card-soft home-muted flex h-full items-center justify-center rounded-lg">
                광고 배너
            </div>
        </aside>
    );
}
