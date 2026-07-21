import TypingText from "@/components/home/TypingText";
import Buttons from "@/components/home/Buttons";
import Frame from "@/components/home/Frame";
import MovingRow from "@/components/home/MovingRow";
import DestinationImageCard from "@/components/home/DestinationImageCard";
import KoreaRecommendationCard from "@/components/home/KoreaRecommendationCard";
import TokyoRecommendationCard from "@/components/home/TokyoRecommendationCard";
import busan from "@/image/Busan.png";
import fukuoka from "@/image/fukuoka.png";
import jeju from "@/image/Jeju.png";
import nagoya from "@/image/Nagoya.png";
import osaka from "@/image/Osaka.png";
import sapporo from "@/image/Sapporo.png";
import seoul from "@/image/Seoul.png";
import { MapPinned, Route, UsersRound } from "lucide-react";

const highlights = [
    { icon: MapPinned, label: "장소 저장", value: "가고 싶은 곳만 빠르게 담기" },
    { icon: Route, label: "동선 정리", value: "날짜별 이동 흐름 확인" },
    { icon: UsersRound, label: "같이 편집", value: "초대 링크로 함께 수정" },
];

const koreaDestinations = [
    { city: "seoul" as const, title: "Seoul", description: "2박 3일 · 4박 5일 일정 만들기", image: seoul, alt: "서울 여행지 이미지" },
    { city: "busan" as const, title: "Busan", description: "2박 3일 · 4박 5일 일정 만들기", image: busan, alt: "부산 여행지 이미지" },
    { city: "jeju" as const, title: "Jeju", description: "2박 3일 · 4박 5일 일정 만들기", image: jeju, alt: "제주 여행지 이미지" },
];

const destinations = [
    { city: "Osaka", description: "먹거리와 쇼핑 동선", image: osaka, alt: "오사카 여행지 이미지" },
    { city: "Fukuoka", description: "가볍게 떠나는 온천 여행", image: fukuoka, alt: "후쿠오카 여행지 이미지" },
    { city: "Sapporo", description: "계절감 있는 북쪽 여행", image: sapporo, alt: "삿포로 여행지 이미지" },
    { city: "Nagoya", description: "근교까지 묶는 일정", image: nagoya, alt: "나고야 여행지 이미지" },
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

                    <div
                        className="home-card home-muted mt-8 flex h-[92px] w-full items-center justify-center rounded-xl border border-dashed px-4 text-sm font-semibold shadow-sm sm:hidden"
                        aria-label="모바일 광고 배너 영역"
                    >
                        광고 배너
                    </div>

                    <div className="mt-8 hidden w-full gap-3 sm:grid sm:grid-cols-3">
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
                    {koreaDestinations.map((destination) => (
                        <KoreaRecommendationCard key={destination.city} {...destination} />
                    ))}
                    {destinations.map((destination) => (
                        <DestinationImageCard key={destination.city} {...destination} />
                    ))}
                </MovingRow>
            </div>
        </section>
    );
}
