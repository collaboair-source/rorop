import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfile, profileHash, saveProfile } from "@/lib/support/store";
import { CERTIFICATION_OPTIONS, INTEREST_OPTIONS, REGION_OPTIONS } from "@/lib/support/profile-default";
import type { BusinessProfile } from "@/lib/support/types";
import { parseDate } from "@/lib/support/text";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = getProfile();
  return NextResponse.json({
    profile,
    hash: profileHash(profile),
    options: { interests: INTEREST_OPTIONS, certifications: CERTIFICATION_OPTIONS, regions: REGION_OPTIONS },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<BusinessProfile> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const current = getProfile();
  const list = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : typeof v === "string" ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : fallback;
  const num = (v: unknown, fallback: number) => (v === "" || v === null || v === undefined ? fallback : Number.isFinite(Number(v)) ? Number(v) : fallback);

  const next: BusinessProfile = {
    company_name: String(body.company_name ?? current.company_name),
    description: String(body.description ?? current.description),
    products: String(body.products ?? current.products),
    industry: String(body.industry ?? current.industry),
    keywords: list(body.keywords, current.keywords),
    business_type: (["예비창업자", "개인사업자", "법인"] as const).includes(body.business_type as BusinessProfile["business_type"]) ? (body.business_type as BusinessProfile["business_type"]) : current.business_type,
    founded_at: body.founded_at === undefined ? current.founded_at : parseDate(body.founded_at as string),
    region: String(body.region ?? current.region),
    employees: num(body.employees, current.employees),
    annual_revenue_million_krw: num(body.annual_revenue_million_krw, current.annual_revenue_million_krw),
    certifications: list(body.certifications, current.certifications),
    representative_age: body.representative_age === undefined ? current.representative_age : body.representative_age === null || body.representative_age === ("" as unknown) ? null : num(body.representative_age, 0) || null,
    representative_gender: (["male", "female", ""] as const).includes(body.representative_gender as BusinessProfile["representative_gender"]) ? (body.representative_gender as BusinessProfile["representative_gender"]) : current.representative_gender,
    interests: list(body.interests, current.interests),
    goals: String(body.goals ?? current.goals),
    constraints: String(body.constraints ?? current.constraints),
    stretch_tolerance: (["conservative", "moderate", "aggressive"] as const).includes(body.stretch_tolerance as BusinessProfile["stretch_tolerance"]) ? (body.stretch_tolerance as BusinessProfile["stretch_tolerance"]) : current.stretch_tolerance,
    updated_at: new Date().toISOString(),
  };
  if (next.business_type === "예비창업자") next.founded_at = null;

  const saved = saveProfile(next);
  return NextResponse.json({ profile: saved, hash: profileHash(saved) });
}
