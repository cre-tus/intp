import type { ItineraryActivity, ItineraryDay } from "@/components/planner/TravelItinerary";
import { createClientId } from "@/lib/ids";
import { createEmptyTravelPlan, type TravelPlanDraft } from "@/lib/travelPlans";

export type TokyoTripDuration = "2n3d" | "4n5d";

type TokyoSpot = {
    time: string;
    location: string;
    activity: string;
    cost: number;
    lat: number;
    lon: number;
    routeRole?: ItineraryActivity["routeRole"];
};

const TOKYO_HOTEL = {
    location: "신주쿠역 인근 호텔",
    lat: 35.6909,
    lon: 139.7003,
};

const TOKYO_2N3D: TokyoSpot[][] = [
    [
        spot("10:00", "신주쿠 교엔", "도착 후 산책으로 컨디션 정리", 500, 35.6852, 139.7100, "FIXED"),
        spot("12:00", "오모이데요코초", "점심과 골목 구경", 1800, 35.6938, 139.6994, "FIXED"),
        spot("15:00", "메이지 신궁", "도심 속 숲길 코스", 0, 35.6764, 139.6993, "FIXED"),
        spot("18:30", "시부야 스크램블 교차로", "야경과 저녁", 2500, 35.6595, 139.7005, "FIXED"),
    ],
    [
        spot("09:30", "아사쿠사 센소지", "전통 거리와 사찰 산책", 0, 35.7148, 139.7967, "FIXED"),
        spot("12:30", "우에노 아메요코", "시장 점심", 1800, 35.7076, 139.7745, "FIXED"),
        spot("15:00", "아키하바라", "전자상가와 취향 쇼핑", 2000, 35.6984, 139.7730, "FIXED"),
        spot("19:00", "도쿄역 마루노우치", "저녁 산책", 2500, 35.6812, 139.7671, "FIXED"),
    ],
    [
        spot("10:00", "츠키지 장외시장", "아침 겸 점심", 2500, 35.6655, 139.7707, "FIXED"),
        spot("13:00", "긴자", "카페와 쇼핑", 1800, 35.6717, 139.7650, "FIXED"),
        spot("16:00", "하네다 공항", "출국 준비", 0, 35.5494, 139.7798, "END"),
    ],
];

const TOKYO_4N5D: TokyoSpot[][] = [
    ...TOKYO_2N3D.slice(0, 2),
    [
        spot("09:30", "하라주쿠 다케시타도리", "가벼운 쇼핑과 간식", 1800, 35.6717, 139.7030, "FIXED"),
        spot("12:30", "오모테산도", "점심과 카페", 2800, 35.6652, 139.7123, "FIXED"),
        spot("15:30", "롯폰기 힐즈", "전망과 전시", 2500, 35.6605, 139.7292, "FIXED"),
        spot("19:00", "도쿄타워", "야경", 1200, 35.6586, 139.7454, "FIXED"),
    ],
    [
        spot("09:30", "기치조지", "로컬 상권 산책", 1600, 35.7031, 139.5797, "FIXED"),
        spot("11:30", "이노카시라 공원", "공원 산책", 0, 35.7003, 139.5765, "FIXED"),
        spot("15:00", "나카메구로", "카페와 편집숍", 2200, 35.6441, 139.6992, "FIXED"),
        spot("18:30", "에비스", "저녁", 3000, 35.6467, 139.7101, "FIXED"),
    ],
    [
        spot("10:00", "도요스 시장", "마지막 식사", 2600, 35.6431, 139.7810, "FIXED"),
        spot("13:00", "오다이바", "바다 쪽 산책", 1200, 35.6256, 139.7757, "FIXED"),
        spot("17:00", "하네다 공항", "출국 준비", 0, 35.5494, 139.7798, "END"),
    ],
];

export function createTokyoRecommendedPlan(
    id: string,
    duration: TokyoTripDuration,
    owner?: { id: number; email: string; name: string },
): TravelPlanDraft {
    const title = duration === "2n3d" ? "도쿄 2박 3일 일정" : "도쿄 4박 5일 일정";
    const plan = createEmptyTravelPlan(id, title, "basic", "FREE");
    plan.tripContext.countryCode = "JP";
    const schedule = duration === "2n3d" ? TOKYO_2N3D : TOKYO_4N5D;

    plan.days = schedule.map((spots, index): ItineraryDay => ({
        id: createClientId("day"),
        date: "",
        dayTitle: `Day ${index + 1}`,
        activities: [
            {
                id: createClientId("activity"),
                time: "08:30",
                location: TOKYO_HOTEL.location,
                activity: "숙소 출발",
                cost: 0,
                lat: TOKYO_HOTEL.lat,
                lon: TOKYO_HOTEL.lon,
                routeRole: "LODGING",
            },
            ...spots.map((item) => ({
                id: createClientId("activity"),
                ...item,
            })),
        ],
    }));

    plan.checklist = [
        { id: Date.now(), text: "Suica/PASMO 교통카드 준비", checked: false, cost: 0 },
        { id: Date.now() + 1, text: "포켓 와이파이 또는 eSIM", checked: false, cost: 0 },
        { id: Date.now() + 2, text: "숙소 주소와 공항 이동 경로 저장", checked: false, cost: 0 },
    ];

    if (owner) {
        plan.participants = [{
            id: owner.id,
            name: owner.name,
            email: owner.email,
            role: "OWNER",
        }];
    }

    return plan;
}

function spot(
    time: string,
    location: string,
    activity: string,
    cost: number,
    lat: number,
    lon: number,
    routeRole: ItineraryActivity["routeRole"],
): TokyoSpot {
    return { time, location, activity, cost, lat, lon, routeRole };
}
