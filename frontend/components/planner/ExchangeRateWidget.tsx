"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeJapaneseYen, Check, RefreshCw } from "lucide-react";
import { DEFAULT_CURRENCY, type CurrencyRate } from "@/lib/currency";

type ExchangeRateResponse = {
    searchDate: string;
    source: string;
    rates: CurrencyRate[];
    message?: string;
};

type ExchangeRateWidgetProps = {
    selectedCurrency: CurrencyRate;
    onCurrencyChange: (currency: CurrencyRate) => void;
};

const preferredOrder = ["KRW", "JPY(100)", "USD", "EUR", "GBP", "CNH"];

export default function ExchangeRateWidget({
    selectedCurrency,
    onCurrencyChange,
}: ExchangeRateWidgetProps) {
    const [data, setData] = useState<ExchangeRateResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadRates = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/exchange-rate-api", { cache: "no-store" });
            const payload = await response.json() as ExchangeRateResponse;

            if (!response.ok) {
                throw new Error(payload.message || "환율을 불러오지 못했습니다.");
            }

            setData(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "환율을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadRates();
    }, []);

    const rates = useMemo(() => {
        const byUnit = new Map<string, CurrencyRate>();
        byUnit.set(DEFAULT_CURRENCY.unit, DEFAULT_CURRENCY);
        for (const rate of data?.rates ?? []) {
            byUnit.set(rate.unit, rate);
        }

        return [...byUnit.values()].sort(
            (left, right) => preferredOrder.indexOf(left.unit) - preferredOrder.indexOf(right.unit),
        );
    }, [data]);

    return (
        <section className="border-t border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <BadgeJapaneseYen className="h-4 w-4 shrink-0 text-gray-900" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-950">환율</h3>
                        <p className="truncate text-xs text-gray-500">
                            {data?.searchDate ? `${formatDate(data.searchDate)} 기준` : "기본 원화"}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void loadRates()}
                    disabled={loading}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-gray-950 disabled:cursor-wait disabled:opacity-50"
                    title="환율 새로고침"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="mt-3 space-y-2">
                {loading && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                        환율을 불러오는 중입니다.
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {rates.map((rate) => {
                    const selected = selectedCurrency.unit === rate.unit;
                    return (
                        <button
                            key={rate.unit}
                            type="button"
                            onClick={() => onCurrencyChange(rate)}
                            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                selected
                                    ? "border-gray-950 bg-gray-950 text-white"
                                    : "border-gray-200 bg-gray-50 text-gray-950 hover:border-gray-300 hover:bg-white"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-sm font-bold">
                                        {displayUnit(rate.unit)}
                                        {selected && <Check className="h-3.5 w-3.5" />}
                                    </div>
                                    <div className={`truncate text-xs ${selected ? "text-white/70" : "text-gray-500"}`}>
                                        {rate.name}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold">{rate.baseRate}</div>
                                    <div className={`text-[11px] ${selected ? "text-white/70" : "text-gray-500"}`}>
                                        {rate.unit === "KRW" ? "기본" : "KRW"}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function displayUnit(unit: string) {
    return unit === "JPY(100)" ? "JPY 100" : unit;
}

function formatDate(value: string) {
    if (value.length !== 8) return value;
    return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}
