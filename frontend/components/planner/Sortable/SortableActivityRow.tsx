"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ActivityRow from "../ActivityRow";

type ActivityRowProps = React.ComponentProps<typeof ActivityRow>;

export default function SortableActivityRow(props: ActivityRowProps) {
    const {
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        attributes,
        listeners,
        isDragging,
    } = useSortable({ id: props.activity.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.9 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <ActivityRow
                {...props}
                dragHandleProps={{ attributes, listeners, setActivatorNodeRef }}
            />
        </div>
    );
}
