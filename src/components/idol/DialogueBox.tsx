"use client";

/** 말풍선 — 월 계획·리포트에서 하람의 한마디를 보여준다 */

export function DialogueBox({
  text,
  speaker,
  className = "",
}: {
  text: string;
  speaker?: string;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div
      className={`relative rounded-2xl border border-[#2C3766] bg-[#161E3A] px-3 py-2.5 ${className}`}
    >
      {speaker ? (
        <p className="mb-0.5 text-[11px] font-bold tracking-wide text-[#5EEAD4]">{speaker}</p>
      ) : null}
      <p className="whitespace-pre-line text-[13px] leading-6 text-[#EEF0FF]">{text}</p>
    </div>
  );
}
