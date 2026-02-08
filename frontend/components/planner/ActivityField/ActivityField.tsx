import React from "react";
import { Edit3 } from "lucide-react";

export default function ActivityField(props: {
    value: string;
    onChange: (next: string) => void;
}) {
    return (
        <div className="flex items-center gap-2 flex-[3] bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 group-hover:border-gray-300 transition-colors">
        <Edit3 className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <input
            type="text"
    value={props.value}
    onChange={(e) => props.onChange(e.target.value)}
    placeholder="활동 내용을 입력하세요"
    className="w-full bg-transparent focus:outline-none font-medium"
        />
        </div>
);
}
