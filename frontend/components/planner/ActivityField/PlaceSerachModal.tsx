import { X } from "lucide-react";
import PlaceSearchInput, { PlaceResult } from "./PlaceSerachInput"

export default function PlaceSearchModal(props: {
    open: boolean;
    onClose: () => void;
    onSelect: (place: PlaceResult) => void;
    initialQuery?: string;
    showFixedOption?: boolean;
    fixedOptionChecked?: boolean;
    onFixedOptionChange?: (checked: boolean) => void;
    paidPlaces?: boolean;
    planId?: string;
}) {
    if (!props.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={props.onClose}
            />

            <div className="relative flex max-h-[96dvh] w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white p-3 shadow-xl sm:w-[1040px] sm:max-w-[94vw] sm:rounded-xl sm:p-4">
                <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                    <div className="font-semibold">장소 검색</div>
                    <button onClick={props.onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="min-h-0 overflow-y-auto overflow-x-hidden">
                    <PlaceSearchInput
                        initialQuery={props.initialQuery}
                        showFixedOption={props.showFixedOption}
                        fixedOptionChecked={props.fixedOptionChecked}
                        onFixedOptionChange={props.onFixedOptionChange}
                        paidPlaces={props.paidPlaces}
                        planId={props.planId}
                        onSelect={(place) => {
                            props.onSelect(place);
                            props.onClose();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
