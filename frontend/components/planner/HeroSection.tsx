import TravelCheckList from "@/components/planner/TravelCheckList";
import TravelItinerary from "@/components/planner/TravelItinerary";
import ParticipantsSidebar from "@/components/planner/ParticipantsSidebar";

export default function HeroSection() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">

                {/* ✅ 제목은 단독 영역 */}
                <h1 className="
          mb-10
          font-[var(--font-paperlogy)]
          font-normal
          text-[32px]
          leading-[1.05]
          tracking-[-0.02em]
          text-black
        ">
                    여행 일정표 - 기본 템플릿
                </h1>

                {/* ✅ 여기서부터 좌/우 레이아웃 */}
                <div className="flex gap-6 items-start">

                    {/* 왼쪽 메인 콘텐츠 */}
                    <div className="flex-1 space-y-8">
                        <TravelCheckList />
                        <TravelItinerary />
                    </div>

                    {/* 오른쪽 사이드바 */}
                    <div className="w-80 shrink-0">
                        <ParticipantsSidebar />
                    </div>

                </div>
            </div>
        </div>
    );
}
