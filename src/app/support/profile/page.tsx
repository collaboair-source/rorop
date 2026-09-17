"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import type { BusinessProfile } from "@/lib/support/types";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Options {
  interests: string[];
  certifications: string[];
  regions: string[];
}

const TOLERANCE: { value: BusinessProfile["stretch_tolerance"]; label: string; desc: string }[] = [
  { value: "conservative", label: "보수적", desc: "요건을 확실히 충족하는 공고와 위험 낮은 각도만" },
  { value: "moderate", label: "보통", desc: "사실 기반 재해석으로 끼워 넣을 수 있는 각도까지" },
  { value: "aggressive", label: "적극적", desc: "위험이 있어도 가능한 모든 각도와 새로 갖출 요건까지 최대한 제안" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) {
          router.push("/login");
          return;
        }
        setUser((await r.json()).user);
      })
      .catch(() => router.push("/login"));
    fetch("/api/support/profile").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setProfile(data.profile);
      setOptions(data.options);
      setKeywordsText(data.profile.keywords.join(", "));
    });
  }, [router]);

  if (!user || !profile || !options) return null;

  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => setProfile({ ...profile, [key]: value });
  const toggle = (key: "interests" | "certifications", value: string) => {
    const cur = profile[key];
    set(key, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const body = { ...profile, keywords: keywordsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) };
    const r = await fetch("/api/support/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setMessage(data.error || "저장 실패");
      return;
    }
    setProfile(data.profile);
    setKeywordsText(data.profile.keywords.join(", "));
    setMessage("저장했습니다. 목록의 점수가 새 프로필 기준으로 다시 계산됩니다. 기존 AI 분석은 '다시 분석'을 권장합니다.");
  }

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">내 사업 프로필</h1>
            <p className="text-gray-500 text-sm mt-1">여기 적은 내용이 모든 공고의 매칭 점수와 AI 가이드의 기준이 됩니다. 구체적일수록 정확합니다.</p>
          </div>
          <Link href="/support" className="text-sm text-gray-500 hover:text-gray-700">← 지원사업 목록</Link>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {message && <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm px-4 py-3 rounded-lg">{message}</div>}

          <Section title="사업 내용">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">회사/팀 이름</label>
                <input value={profile.company_name} onChange={(e) => set("company_name", e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">업종</label>
                <input value={profile.industry} onChange={(e) => set("industry", e.target.value)} className={input} placeholder="예: 소프트웨어 개발 및 공급업" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">사업 설명</label>
              <textarea value={profile.description} onChange={(e) => set("description", e.target.value)} rows={4} className={input} placeholder="무엇을, 누구에게, 어떻게 제공하는지. 기술·차별점·현재 단계(아이디어/MVP/매출 발생)를 포함" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">주요 제품 / 서비스</label>
              <input value={profile.products} onChange={(e) => set("products", e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">핵심 키워드 (쉼표 구분) — 공고 제목/본문과 대조됩니다</label>
              <input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} className={input} placeholder="SaaS, 디자인, 협업툴, AI, 플랫폼" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">지원사업으로 얻고 싶은 것</label>
              <input value={profile.goals} onChange={(e) => set("goals", e.target.value)} className={input} placeholder="사업화 자금, 입주 공간, 멘토링, 판로, 인건비 지원 …" />
            </div>
          </Section>

          <Section title="자격 정보 (요건 판정에 사용)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">사업 형태</label>
                <select value={profile.business_type} onChange={(e) => set("business_type", e.target.value as BusinessProfile["business_type"])} className={input}>
                  <option value="예비창업자">예비창업자 (사업자 등록 전)</option>
                  <option value="개인사업자">개인사업자</option>
                  <option value="법인">법인</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">창업일 (사업자 등록일)</label>
                <input type="date" value={profile.founded_at || ""} disabled={profile.business_type === "예비창업자"} onChange={(e) => set("founded_at", e.target.value || null)} className={`${input} disabled:bg-gray-50`} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">사업장 소재지</label>
                <select value={profile.region} onChange={(e) => set("region", e.target.value)} className={input}>
                  <option value="">선택</option>
                  {options.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">임직원 수</label>
                <input type="number" min={0} value={profile.employees} onChange={(e) => set("employees", Number(e.target.value) || 0)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">연 매출 (백만원)</label>
                <input type="number" min={0} value={profile.annual_revenue_million_krw} onChange={(e) => set("annual_revenue_million_krw", Number(e.target.value) || 0)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">대표자 나이 (만) / 성별</label>
                <div className="flex gap-2">
                  <input type="number" min={0} value={profile.representative_age ?? ""} onChange={(e) => set("representative_age", e.target.value === "" ? null : Number(e.target.value))} className={input} placeholder="예: 34" />
                  <select value={profile.representative_gender} onChange={(e) => set("representative_gender", e.target.value as BusinessProfile["representative_gender"])} className={input}>
                    <option value="">미입력</option>
                    <option value="female">여성</option>
                    <option value="male">남성</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">보유 인증 / 자격</label>
              <ChipGroup options={options.certifications} selected={profile.certifications} onToggle={(v) => toggle("certifications", v)} />
            </div>
          </Section>

          <Section title="관심 분야와 매칭 성향">
            <div>
              <label className="block text-sm font-medium mb-2">관심 지원 분야</label>
              <ChipGroup options={options.interests} selected={profile.interests} onToggle={(v) => toggle("interests", v)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">끼워 맞추기 허용 정도 (AI 가 각도를 얼마나 적극적으로 제안할지)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TOLERANCE.map((t) => (
                  <label key={t.value} className={`border rounded-lg p-3 cursor-pointer text-sm ${profile.stretch_tolerance === t.value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"}`}>
                    <input type="radio" name="tol" className="mr-2" checked={profile.stretch_tolerance === t.value} onChange={() => set("stretch_tolerance", t.value)} />
                    <span className="font-medium">{t.label}</span>
                    <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">제약 / 메모</label>
              <textarea value={profile.constraints} onChange={(e) => set("constraints", e.target.value)} rows={2} className={input} placeholder="예: 지방 이전 불가, 자부담 매칭 자금 여력 없음, 올해 안에 법인 전환 예정" />
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "저장 중…" : "프로필 저장"}
            </button>
            <span className="text-xs text-gray-400">마지막 저장: {profile.updated_at && new Date(profile.updated_at).getTime() > 0 ? new Date(profile.updated_at).toLocaleString("ko-KR") : "아직 저장 안 함 (기본값)"}</span>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)} className={`text-sm px-3 py-1 rounded-full border ${on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:border-indigo-300"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
