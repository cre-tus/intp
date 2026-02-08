import React from "react";
import { MapPin } from "lucide-react";

export default function LocationField(props: {
    value: string;
    onChange: (next: string) => void;
}) {
    return (
        <div className="flex items-center gap-2 flex-[2] bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 group-hover:border-gray-300 transition-colors">
            <MapPin className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <input
                type="text"
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
                placeholder="장소를 입력하세요"
                className="w-full bg-transparent focus:outline-none font-medium"
            />
        </div>
    );
}
