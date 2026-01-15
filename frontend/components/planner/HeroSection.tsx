import TravelCheckList from "@/components/planner/TravelCheckList";

export default function HeroSection() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="font-[var(--font-paperlogy)] font-normal text-[32px] leading-[1.05] tracking-[-0.02em] text-black mb-[-0.1px]" >여행 일정표 - 기본 템플릿</h1>
                    </div>

                    <TravelCheckList />
                </div>
            </div>
        </div>
    );
}