import React from "react";
import { Trash2 } from "lucide-react";

export default function DeleteButton(props: { onClick: () => void }) {
    return (
        <button
            onClick={props.onClick}
            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 hover:scale-110"
            type="button"
        >
            <Trash2 className="w-4 h-4 text-red-600" />
        </button>
    );
}
