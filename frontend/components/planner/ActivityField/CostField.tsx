import React from "react";

export default function CostField(props: {
    value: number;
    onChange: (next: number) => void;
}) {
    const handleChange = (value: string) => {
        const digits = value.replace(/\D/g, "");
        props.onChange(digits ? Number(digits) : 0);
    };

    return (
        <div className="w-[120px] rounded-lg border-2 border-gray-300 bg-gradient-to-r from-gray-100 to-gray-50 px-3 py-2">
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={props.value ? props.value.toLocaleString() : ""}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="경비"
                className="w-full bg-transparent font-bold text-gray-900 focus:outline-none"
            />
        </div>
    );
}
