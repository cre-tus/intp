import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_URL = process.env.ML_RECOMMENDER_URL ?? "http://127.0.0.1:8091";

export async function GET(request: NextRequest) {
    if (!await isAdminRequest(request)) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    try {
        const token = requireToken();
        const target = new URL(`${ML_URL.replace(/\/$/, "")}/training-places`);
        for (const key of ["q", "reviewStatus", "sort", "category", "placeType"]) {
            const value = request.nextUrl.searchParams.get(key);
            if (value) target.searchParams.set(key, value);
        }
        const response = await fetch(target, { headers: { "X-ML-Admin-Token": token }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        const payload = await response.json() as { items?: unknown[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? `ML 학습 장소 조회 오류 (${response.status})`);
        return NextResponse.json(payload.items ?? []);
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "ML 학습 장소를 불러오지 못했습니다." }, { status: 503 });
    }
}

export async function POST(request: NextRequest) {
    if (!await isAdminRequest(request)) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    try {
        const response = await fetch(`${ML_URL.replace(/\/$/, "")}/training-places`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-ML-Admin-Token": requireToken() },
            body: JSON.stringify(await request.json()),
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) return NextResponse.json({ message: payload.error ?? "학습 장소 수정에 실패했습니다." }, { status: response.status });
        return NextResponse.json(payload);
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "학습 장소 수정에 실패했습니다." }, { status: 500 });
    }
}

function requireToken() {
    const token = process.env.ML_TRAIN_TOKEN;
    if (!token) throw new Error("ML 학습 토큰이 설정되지 않았습니다.");
    return token;
}

async function isAdminRequest(request: NextRequest) {
    const cookie = request.headers.get("cookie");
    if (!cookie) return false;
    for (const baseUrl of [process.env.BACKEND_INTERNAL_URL, "http://backend:8080", "http://localhost:8080"].filter((value): value is string => Boolean(value))) {
        try {
            const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie }, cache: "no-store", signal: AbortSignal.timeout(3_000) });
            if (!response.ok) continue;
            return ((await response.json()) as { role?: string }).role === "ADMIN";
        } catch { /* try next backend */ }
    }
    return false;
}
