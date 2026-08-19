export type CurrencyRate = {
    unit: string;
    name: string;
    baseRate: string;
    buyRate?: string;
    sellRate?: string;
};

export const DEFAULT_CURRENCY: CurrencyRate = {
    unit: "KRW",
    name: "대한민국 원",
    baseRate: "1",
};

export const STORED_JPY_CURRENCY: CurrencyRate = {
    unit: "JPY",
    name: "일본 엔 (입력값 그대로)",
    baseRate: "1",
};

export function formatCurrencyAmount(amountKrw: number, currency: CurrencyRate) {
    if (currency.unit === "KRW") {
        return `${Math.round(amountKrw).toLocaleString()}원`;
    }
    if (currency.unit === "JPY") {
        return `${Math.round(amountKrw).toLocaleString()}엔`;
    }

    const rate = parseExchangeRate(currency.baseRate);
    if (!rate) {
        return `${Math.round(amountKrw).toLocaleString()}원`;
    }

    const unitMultiplier = currency.unit === "JPY(100)" ? 100 : 1;
    const converted = (amountKrw * unitMultiplier) / rate;
    const maximumFractionDigits = converted >= 100 ? 0 : 2;

    return `${converted.toLocaleString(undefined, {
        maximumFractionDigits,
    })} ${displayCurrencyUnit(currency.unit)}`;
}

export function displayCurrencyUnit(unit: string) {
    return unit === "JPY(100)" ? "JPY" : unit;
}

function parseExchangeRate(value?: string) {
    if (!value) return 0;
    return Number(value.replaceAll(",", ""));
}
