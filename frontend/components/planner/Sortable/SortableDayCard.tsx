"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DayCard from "../DayCard";

type DayCardProps = React.ComponentProps<typeof DayCard>;

export default function SortableDayCard(props: DayCardProps) {
    const {
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        attributes,
        listeners,
    } = useSortable({ id: props.day.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <DayCard
                {...props}
                dragHandleProps={{ attributes, listeners, setActivatorNodeRef }}
            />
        </div>
    );
}
