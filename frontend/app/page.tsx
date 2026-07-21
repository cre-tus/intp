import HeroSection from "@/components/home/HeroSection";
import Header from "@/app/header";
import KlookAffiliateWidget from "@/components/ads/KlookAffiliateWidget";
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
    const offset = "max(24px, calc((100vw - 1280px) / 2 - 196px))";
    const positionStyle: CSSProperties = isLeft ? { left: offset } : { right: offset };

    return (
        <aside
            className="fixed top-1/2 z-20 hidden h-[600px] w-[160px] -translate-y-1/2 overflow-hidden rounded-xl shadow-sm [@media(min-width:1720px)]:block"
            style={positionStyle}
            aria-label={`${isLeft ? "왼쪽" : "오른쪽"} 광고 배너 영역`}
        >
            <KlookAffiliateWidget />
        </aside>
    );
}
