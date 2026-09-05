/** 표시용 문자열 포맷 (순수 함수, 컴포넌트 어디서나 쓴다) */

export function monthLabel(month: number): string {
  const year = Math.floor((month - 1) / 12) + 1;
  const inYear = ((month - 1) % 12) + 1;
  return `${year}년차 ${inYear}월`;
}

export function yearLabel(month: number): string {
  return `${Math.floor((month - 1) / 12) + 1}년차`;
}

/** 부호를 항상 붙인다 (− 는 U+2212) */
export function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function moneyText(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}만`;
}

export function savedAtText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** 월에서 결정적으로 만드는 버블 시각 (04 문서 3.3) */
export function bubbleTime(month: number): string {
  const hour = 7 + (month % 3);
  const minute = (month * 17) % 60;
  return `오후 ${hour}:${String(minute).padStart(2, "0")}`;
}
