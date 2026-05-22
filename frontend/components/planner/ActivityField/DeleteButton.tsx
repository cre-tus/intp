import React from "react";
import { Trash2 } from "lucide-react";

export default function DeleteButton(props: { onClick: () => void }) {
    return (
        <button
            onClick={props.onClick}
            className="flex-shrink-0 rounded-lg p-2 transition-all hover:scale-110 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100"
            type="button"
            aria-label="일정 삭제"
        >
            <Trash2 className="w-4 h-4 text-red-600" />
        </button>
    );
}
