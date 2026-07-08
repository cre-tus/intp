import TypingText from "@/components/home/TypingText";
import Buttons from "@/components/home/Buttons";
import Frame from "@/components/home/Frame";
import MovingRow from "@/components/home/MovingRow";
import Image2 from "@/components/home/MovingRowImage/Image2";
import Image3 from "@/components/home/MovingRowImage/Image3";
import Image4 from "@/components/home/MovingRowImage/Image4";
import Image5 from "@/components/home/MovingRowImage/Image5";
import TokyoRecommendationCard from "@/components/home/TokyoRecommendationCard";
import { MapPinned, Route, UsersRound } from "lucide-react";

const highlights = [
    { icon: MapPinned, label: "장소 저장", value: "가고 싶은 곳만 담기" },
    { icon: Route, label: "동선 정리", value: "날짜별 이동 흐름 확인" },
    { icon: UsersRound, label: "같이 편집", value: "초대 링크로 함께 수정" },
];

export default function HeroSection() {
    return (
        <section className="home-surface home-border w-full overflow-x-hidden border-t">
            <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-12 sm:px-6 sm:pb-16 lg:pt-20">
                <div className="mx-auto flex max-w-5xl min-w-0 flex-col items-center text-center">
                    <h1 className="home-text break-keep font-[var(--font-paperlogy)] text-[40px] font-black leading-[1.06] sm:text-6xl lg:text-[72px]">
                        여행 계획,
                        <span className="home-muted block">같이 만들면 더 쉽다</span>
                    </h1>

                    <TypingText />
                    <Buttons />

                    <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                        {highlights.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.label}
                                    className="home-card rounded-xl border px-4 py-4 text-left shadow-sm"
                                >
                                    <div className="home-text flex items-center gap-2 text-sm font-semibold">
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </div>
                                    <p className="home-muted mt-2 break-keep text-sm leading-5">{item.value}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Frame />

                <MovingRow>
                    <TokyoRecommendationCard />
                    <Image2 />
                    <Image3 />
                    <Image4 />
                    <Image5 />
                </MovingRow>
            </div>
        </section>
    );
}
