import React from "react";

export default function CostField(props: {
    value: number;
    onChange: (next: number) => void;
}) {
    return (
        <div className="w-[120px] bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg px-3 py-2 border-2 border-gray-300">
        <input
            type="number"
    value={props.value}
    onChange={(e) => props.onChange(Number(e.target.value) || 0)}
    placeholder="경비"
    className="w-full bg-transparent focus:outline-none font-bold text-gray-900"
        />
        </div>
);
}
