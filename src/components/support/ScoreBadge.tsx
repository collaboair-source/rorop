export function scoreColor(score: number) {
  if (score >= 75) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 55) return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (score >= 35) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export default function ScoreBadge({ score, label, size = "md" }: { score: number; label?: string; size?: "md" | "lg" }) {
  const cls = scoreColor(score);
  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-lg border ${cls} ${size === "lg" ? "w-20 h-20" : "w-14 h-14"}`}>
      <div className={`${size === "lg" ? "text-3xl" : "text-xl"} font-bold leading-none`}>{score}</div>
      <div className="text-[10px] mt-1 opacity-80">{label || "매칭"}</div>
    </div>
  );
}

export const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  bizinfo: { label: "기업마당", cls: "bg-sky-100 text-sky-700" },
  kstartup: { label: "K-Startup", cls: "bg-emerald-100 text-emerald-700" },
  manual: { label: "직접 추가", cls: "bg-gray-100 text-gray-600" },
};

export function SourceBadge({ source }: { source: string }) {
  const b = SOURCE_BADGE[source] || SOURCE_BADGE.manual;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>;
}

export function DeadlineBadge({ status, daysLeft, applyEnd }: { status: string; daysLeft: number | null; applyEnd: string | null }) {
  if (status === "closed") return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">마감</span>;
  if (status === "unknown") return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">상시/미상</span>;
  const urgent = status === "closing_soon";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgent ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>
      D-{daysLeft} · ~{applyEnd}
    </span>
  );
}

export const FIT_LEVEL_CLS: Record<string, string> = {
  높음: "bg-green-100 text-green-800",
  보통: "bg-indigo-100 text-indigo-800",
  낮음: "bg-amber-100 text-amber-800",
  불가: "bg-gray-200 text-gray-600",
};
