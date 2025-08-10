import type React from "react";

export interface SectionProps {
    title: string;
    children: React.ReactNode;
    right?: React.ReactNode;
}

export function Section({ title, children, right }: SectionProps) {
    return (
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                {right}
            </div>
            {children}
        </div>
    );
}
