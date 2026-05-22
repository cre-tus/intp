import { Edit3 } from "lucide-react";

export default function ActivityField(props: {
    value: string;
    onChange: (next: string) => void;
}) {
    return (
        <div className="flex min-w-0 flex-[3] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 transition-colors group-hover:border-gray-300">
            <Edit3 className="h-4 w-4 flex-shrink-0 text-gray-600" />
            <input
                type="text"
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder="활동 내용을 입력하세요"
                className="min-w-0 w-full bg-transparent font-medium focus:outline-none"
            />
        </div>
    );
}
