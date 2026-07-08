import { NextResponse } from "next/server";

type KoreaEximExchangeRate = {
    result?: number;
    cur_unit?: string;
    cur_nm?: string;
    ttb?: string;
    tts?: string;
    deal_bas_r?: string;
};

const API_URL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON";
const TARGET_UNITS = ["KRW", "JPY(100)", "USD", "EUR", "GBP", "CNH"];

export async function GET() {
    const authKey = process.env.EXCHANGE_RATE_API;

    if (!authKey) {
        return NextResponse.json({ message: "환율 API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    for (const searchDate of recentKoreaDates(8)) {
        const rates = await requestExchangeRates(authKey, searchDate);
        if (!rates.length) continue;

        const filtered = TARGET_UNITS
            .map((unit) => rates.find((rate) => rate.cur_unit === unit))
            .filter((rate): rate is KoreaEximExchangeRate => Boolean(rate))
            .map((rate) => ({
                unit: rate.cur_unit,
                name: normalizeCurrencyName(rate.cur_unit, rate.cur_nm),
                baseRate: rate.deal_bas_r,
                buyRate: rate.tts,
                sellRate: rate.ttb,
            }));

        if (filtered.length > 0) {
            return NextResponse.json({
                searchDate,
                source: "한국수출입은행",
                rates: filtered,
            });
        }
    }

    return NextResponse.json({ message: "조회 가능한 환율 데이터가 없습니다." }, { status: 502 });
}

async function requestExchangeRates(authKey: string, searchDate: string) {
    const params = new URLSearchParams({
        authkey: authKey,
        searchdate: searchDate,
        data: "AP01",
    });

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        next: { revalidate: 60 * 60 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.filter((item): item is KoreaEximExchangeRate => item?.result === 1);
}

function recentKoreaDates(count: number) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const now = new Date();

    return Array.from({ length: count }, (_, index) => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - index);
        return formatter.format(date).replaceAll("-", "");
    });
}

function normalizeCurrencyName(unit?: string, fallback?: string) {
    switch (unit) {
        case "JPY(100)":
            return "일본 엔";
        case "USD":
            return "미국 달러";
        case "EUR":
            return "유로";
        case "GBP":
            return "영국 파운드";
        case "CNH":
            return "중국 위안";
        default:
            return fallback || unit || "통화";
    }
}
