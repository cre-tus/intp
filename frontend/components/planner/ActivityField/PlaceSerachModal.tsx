import { X } from "lucide-react";
import PlaceSearchInput, { PlaceResult } from "./PlaceSerachInput"

export default function PlaceSearchModal(props: {
    open: boolean;
    onClose: () => void;
    onSelect: (place: PlaceResult) => void;
    initialQuery?: string;
}) {
    if (!props.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={props.onClose}
            />

            <div className="relative w-[520px] max-w-[92vw] rounded-xl bg-white shadow-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">장소 검색</div>
                    <button onClick={props.onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <PlaceSearchInput
                    initialQuery={props.initialQuery}
                    onSelect={(place) => {
                        props.onSelect(place);
                        props.onClose();
                    }}
                />
            </div>
        </div>
    );
}
