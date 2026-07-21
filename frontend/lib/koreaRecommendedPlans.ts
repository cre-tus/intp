import type { ItineraryActivity, ItineraryDay } from "@/components/planner/TravelItinerary";
import { createClientId } from "@/lib/ids";
import { createEmptyTravelPlan, type TravelPlanDraft } from "@/lib/travelPlans";

export type KoreaRecommendedCity = "seoul" | "busan" | "jeju";
export type KoreaTripDuration = "2n3d" | "4n5d";

type KoreaSpot = {
    time: string;
    location: string;
    activity: string;
    cost: number;
    placeId: string;
    placeSubtitle: string;
    lat: number;
    lon: number;
    routeRole?: ItineraryActivity["routeRole"];
};

const CITY_LABELS: Record<KoreaRecommendedCity, string> = {
    seoul: "서울",
    busan: "부산",
    jeju: "제주",
};

const LODGINGS: Record<KoreaRecommendedCity, Omit<KoreaSpot, "time" | "activity" | "cost" | "routeRole">> = {
    seoul: place("서울역 인근 숙소", "서울특별시 중구, 대한민국", 37.5573, 126.9712),
    busan: place("해운대 인근 숙소", "부산광역시 해운대구, 대한민국", 35.1587, 129.1604),
    jeju: place("제주시 연동 숙소", "제주특별자치도 제주시, 대한민국", 33.4890, 126.4983),
};

const SEOUL_2N3D: KoreaSpot[][] = [
    [
        spot("10:00", "경복궁", "궁궐 산책과 근정전 관람", 3000, 37.5798, 126.9767, "경복궁, 종로구, 서울특별시, 대한민국", "FIXED"),
        spot("12:30", "북촌한옥마을", "한옥 골목 산책과 점심", 18000, 37.5826, 126.9836, "북촌한옥마을, 종로구, 서울특별시, 대한민국", "FIXED"),
        spot("15:30", "인사동 문화의거리", "전통 공예 숍과 찻집", 12000, 37.5744, 126.9853, "인사동, 종로구, 서울특별시, 대한민국", "FIXED"),
        spot("19:00", "청계천", "야경 산책", 0, 37.5694, 126.9783, "청계천, 중구, 서울특별시, 대한민국", "FIXED"),
    ],
    [
        spot("09:30", "남산서울타워", "전망대와 남산 산책", 21000, 37.5512, 126.9882, "남산서울타워, 용산구, 서울특별시, 대한민국", "FIXED"),
        spot("12:30", "명동", "점심과 쇼핑", 18000, 37.5637, 126.9850, "명동, 중구, 서울특별시, 대한민국", "FIXED"),
        spot("15:30", "동대문디자인플라자", "전시와 디자인 숍", 0, 37.5665, 127.0090, "DDP, 중구, 서울특별시, 대한민국", "FIXED"),
        spot("19:00", "광장시장", "저녁 먹거리 투어", 18000, 37.5700, 126.9996, "광장시장, 종로구, 서울특별시, 대한민국", "FIXED"),
    ],
    [
        spot("10:00", "서울숲", "가벼운 산책과 카페", 9000, 37.5444, 127.0374, "서울숲, 성동구, 서울특별시, 대한민국", "FIXED"),
        spot("13:00", "성수동 카페거리", "브런치와 편집숍", 18000, 37.5446, 127.0557, "성수동, 성동구, 서울특별시, 대한민국", "FIXED"),
        spot("16:30", "서울역", "귀가 준비", 0, 37.5573, 126.9712, "서울역, 중구, 서울특별시, 대한민국", "END"),
    ],
];

const SEOUL_4N5D: KoreaSpot[][] = [
    ...SEOUL_2N3D.slice(0, 2),
    [
        spot("09:30", "창덕궁", "후원 중심 궁궐 코스", 5000, 37.5794, 126.9910, "창덕궁, 종로구, 서울특별시, 대한민국", "FIXED"),
        spot("12:30", "익선동 한옥거리", "점심과 디저트", 20000, 37.5742, 126.9898, "익선동, 종로구, 서울특별시, 대한민국", "FIXED"),
        spot("15:30", "국립중앙박물관", "상설전 관람", 0, 37.5239, 126.9804, "국립중앙박물관, 용산구, 서울특별시, 대한민국", "FIXED"),
        spot("19:00", "한강공원 반포지구", "야경과 산책", 0, 37.5117, 126.9964, "반포한강공원, 서초구, 서울특별시, 대한민국", "FIXED"),
    ],
    [
        spot("10:00", "홍대거리", "소품 숍과 거리 구경", 12000, 37.5563, 126.9236, "홍대거리, 마포구, 서울특별시, 대한민국", "FIXED"),
        spot("13:00", "연남동", "점심과 카페", 20000, 37.5658, 126.9236, "연남동, 마포구, 서울특별시, 대한민국", "FIXED"),
        spot("16:00", "망원시장", "로컬 먹거리", 15000, 37.5568, 126.9057, "망원시장, 마포구, 서울특별시, 대한민국", "FIXED"),
        spot("19:00", "하늘공원", "노을 산책", 0, 37.5673, 126.8856, "하늘공원, 마포구, 서울특별시, 대한민국", "FIXED"),
    ],
    SEOUL_2N3D[2],
];

const BUSAN_2N3D: KoreaSpot[][] = [
    [
        spot("10:00", "해운대해수욕장", "바다 산책", 0, 35.1587, 129.1604, "해운대해수욕장, 해운대구, 부산광역시, 대한민국", "FIXED"),
        spot("12:00", "동백섬", "누리마루와 해안 산책", 0, 35.1526, 129.1527, "동백섬, 해운대구, 부산광역시, 대한민국", "FIXED"),
        spot("15:00", "해리단길", "카페와 편집숍", 12000, 35.1649, 129.1598, "해리단길, 해운대구, 부산광역시, 대한민국", "FIXED"),
        spot("19:00", "광안리해수욕장", "야경과 저녁", 25000, 35.1532, 129.1187, "광안리해수욕장, 수영구, 부산광역시, 대한민국", "FIXED"),
    ],
    [
        spot("09:30", "감천문화마을", "컬러 골목 산책", 0, 35.0975, 129.0106, "감천문화마을, 사하구, 부산광역시, 대한민국", "FIXED"),
        spot("12:30", "국제시장", "점심과 시장 구경", 16000, 35.1018, 129.0289, "국제시장, 중구, 부산광역시, 대한민국", "FIXED"),
        spot("15:00", "BIFF광장", "간식과 영화 거리", 8000, 35.0989, 129.0285, "BIFF광장, 중구, 부산광역시, 대한민국", "FIXED"),
        spot("18:30", "자갈치시장", "해산물 저녁", 30000, 35.0967, 129.0306, "자갈치시장, 중구, 부산광역시, 대한민국", "FIXED"),
    ],
    [
        spot("10:00", "태종대", "해안 절경 산책", 0, 35.0513, 129.0875, "태종대, 영도구, 부산광역시, 대한민국", "FIXED"),
        spot("13:30", "흰여울문화마을", "바다 골목과 카페", 12000, 35.0789, 129.0445, "흰여울문화마을, 영도구, 부산광역시, 대한민국", "FIXED"),
        spot("16:30", "부산역", "귀가 준비", 0, 35.1151, 129.0403, "부산역, 동구, 부산광역시, 대한민국", "END"),
    ],
];

const BUSAN_4N5D: KoreaSpot[][] = [
    ...BUSAN_2N3D.slice(0, 2),
    [
        spot("09:30", "송정해수욕장", "조용한 바다 산책", 0, 35.1786, 129.1997, "송정해수욕장, 해운대구, 부산광역시, 대한민국", "FIXED"),
        spot("12:30", "해동용궁사", "해안 사찰 관람", 0, 35.1883, 129.2233, "해동용궁사, 기장군, 부산광역시, 대한민국", "FIXED"),
        spot("15:30", "아난티 코브", "카페와 바다 전망", 18000, 35.1987, 129.2286, "아난티 코브, 기장군, 부산광역시, 대한민국", "FIXED"),
        spot("19:00", "민락수변공원", "저녁 산책", 12000, 35.1548, 129.1326, "민락수변공원, 수영구, 부산광역시, 대한민국", "FIXED"),
    ],
    [
        spot("10:00", "오륙도 스카이워크", "해안 전망", 0, 35.1006, 129.1223, "오륙도 스카이워크, 남구, 부산광역시, 대한민국", "FIXED"),
        spot("13:00", "이기대 수변공원", "걷기 코스", 0, 35.1252, 129.1196, "이기대 수변공원, 남구, 부산광역시, 대한민국", "FIXED"),
        spot("16:00", "전포카페거리", "카페와 저녁 전 휴식", 12000, 35.1578, 129.0636, "전포카페거리, 부산진구, 부산광역시, 대한민국", "FIXED"),
        spot("19:00", "서면", "저녁과 쇼핑", 25000, 35.1577, 129.0592, "서면, 부산진구, 부산광역시, 대한민국", "FIXED"),
    ],
    BUSAN_2N3D[2],
];

const JEJU_2N3D: KoreaSpot[][] = [
    [
        spot("10:00", "이호테우해변", "도착 후 바다 산책", 0, 33.4972, 126.4525, "이호테우해변, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("12:30", "동문재래시장", "점심과 간식", 16000, 33.5116, 126.5260, "동문재래시장, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("15:30", "용두암", "해안 산책", 0, 33.5161, 126.5116, "용두암, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("19:00", "탑동광장", "저녁과 밤바다", 20000, 33.5177, 126.5231, "탑동광장, 제주시, 제주특별자치도, 대한민국", "FIXED"),
    ],
    [
        spot("09:00", "성산일출봉", "오름과 전망", 5000, 33.4588, 126.9426, "성산일출봉, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("12:30", "섭지코지", "해안 산책", 0, 33.4240, 126.9305, "섭지코지, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("15:30", "비자림", "숲길 산책", 3000, 33.4910, 126.8114, "비자림, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("19:00", "월정리해변", "노을과 저녁", 23000, 33.5565, 126.7958, "월정리해변, 제주시, 제주특별자치도, 대한민국", "FIXED"),
    ],
    [
        spot("10:00", "애월한담해안산책로", "카페와 해안 산책", 14000, 33.4618, 126.3106, "한담해안산책로, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("13:00", "협재해수욕장", "바다 산책", 0, 33.3936, 126.2390, "협재해수욕장, 제주시, 제주특별자치도, 대한민국", "FIXED"),
        spot("16:30", "제주국제공항", "귀가 준비", 0, 33.5104, 126.4914, "제주국제공항, 제주시, 제주특별자치도, 대한민국", "END"),
    ],
];

const JEJU_4N5D: KoreaSpot[][] = [
    ...JEJU_2N3D.slice(0, 2),
    [
        spot("09:30", "오설록 티뮤지엄", "녹차밭과 카페", 12000, 33.3058, 126.2895, "오설록 티뮤지엄, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("12:30", "산방산", "점심과 산방산 전망", 16000, 33.2418, 126.3135, "산방산, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("15:30", "용머리해안", "해안 지형 산책", 2000, 33.2344, 126.3147, "용머리해안, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("19:00", "중문색달해변", "저녁과 해변 산책", 25000, 33.2450, 126.4115, "중문색달해변, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
    ],
    [
        spot("09:30", "천지연폭포", "폭포 산책", 2000, 33.2461, 126.5545, "천지연폭포, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("12:00", "서귀포매일올레시장", "점심과 시장 구경", 18000, 33.2498, 126.5636, "서귀포매일올레시장, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("15:00", "쇠소깍", "하천과 바다 산책", 0, 33.2522, 126.6234, "쇠소깍, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
        spot("18:30", "표선해수욕장", "동쪽 해변 저녁", 22000, 33.3267, 126.8421, "표선해수욕장, 서귀포시, 제주특별자치도, 대한민국", "FIXED"),
    ],
    JEJU_2N3D[2],
];

const SCHEDULES: Record<KoreaRecommendedCity, Record<KoreaTripDuration, KoreaSpot[][]>> = {
    seoul: { "2n3d": SEOUL_2N3D, "4n5d": SEOUL_4N5D },
    busan: { "2n3d": BUSAN_2N3D, "4n5d": BUSAN_4N5D },
    jeju: { "2n3d": JEJU_2N3D, "4n5d": JEJU_4N5D },
};

export function createKoreaRecommendedPlan(
    id: string,
    city: KoreaRecommendedCity,
    duration: KoreaTripDuration,
    owner?: { id: number; email: string; name: string },
): TravelPlanDraft {
    const cityLabel = CITY_LABELS[city];
    const title = `${cityLabel} ${duration === "2n3d" ? "2박 3일" : "4박 5일"} 일정`;
    const plan = createEmptyTravelPlan(id, title, "basic", "FREE");
    plan.tripContext.countryCode = "KR";
    const lodging = LODGINGS[city];

    plan.days = SCHEDULES[city][duration].map((spots, index): ItineraryDay => ({
        id: createClientId("day"),
        date: "",
        dayTitle: `Day ${index + 1}`,
        activities: [
            {
                id: createClientId("activity"),
                time: "08:30",
                location: lodging.location,
                activity: "숙소 출발",
                cost: 0,
                placeId: lodging.placeId,
                placeSubtitle: lodging.placeSubtitle,
                lat: lodging.lat,
                lon: lodging.lon,
                routeRole: "LODGING",
            },
            ...spots.map((item) => ({
                id: createClientId("activity"),
                ...item,
            })),
        ],
    }));

    const checklistBase = Date.now();
    plan.checklist = [
        { id: checklistBase, text: "신분증과 예약 내역 확인", checked: false, cost: 0 },
        { id: checklistBase + 1, text: city === "jeju" ? "렌터카/항공권 시간 확인" : "교통카드와 이동 경로 확인", checked: false, cost: 0 },
        { id: checklistBase + 2, text: "보조배터리와 충전기 준비", checked: false, cost: 0 },
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
    placeSubtitle: string,
    routeRole: ItineraryActivity["routeRole"],
): KoreaSpot {
    return {
        time,
        location,
        activity,
        cost,
        lat,
        lon,
        placeId: `preset:kr:${slug(location)}`,
        placeSubtitle,
        routeRole,
    };
}

function place(location: string, placeSubtitle: string, lat: number, lon: number) {
    return {
        location,
        placeId: `preset:kr:${slug(location)}`,
        placeSubtitle,
        lat,
        lon,
    };
}

function slug(value: string) {
    return encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, "-"));
}
