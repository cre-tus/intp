import { MapPin } from "lucide-react";

export default function LocationField(props: {
    value: string;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={props.onOpen}
            className="pointer-events-auto relative z-20 flex min-w-0 flex-[2] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left transition-colors hover:border-gray-300"
        >
            <MapPin className="h-4 w-4 flex-shrink-0 text-gray-600" />
            <span className={`min-w-0 truncate ${props.value ? "font-medium text-gray-900" : "text-gray-400"}`}>
                {props.value || "장소를 입력하세요"}
            </span>
        </button>
    );
}
