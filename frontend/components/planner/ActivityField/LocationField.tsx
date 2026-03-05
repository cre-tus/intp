import { MapPin } from "lucide-react";

export default function LocationField(props: {
    value: string;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={() => {
                console.log("LocationField click");
                props.onOpen();
            }}
            className="relative z-20 pointer-events-auto flex items-center gap-2 flex-[2] bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-gray-300 transition-colors text-left"
        >
            <MapPin className="w-4 h-4 text-gray-600 flex-shrink-0"/>
            <span className={props.value ? "text-gray-900 font-medium" : "text-gray-400"}>
        {props.value || "장소를 입력하세요"}
      </span>
        </button>
    );
}
