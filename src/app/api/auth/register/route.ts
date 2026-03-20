import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getStore } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password, name, role } = await req.json();

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!["client", "designer"].includes(role)) {
    return NextResponse.json({ error: "Role must be client or designer" }, { status: 400 });
  }

  const store = getStore();

  if (store.users.find((u) => u.email === email)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const user = {
    id: uuidv4(),
    email,
    password_hash: await bcrypt.hash(password, 10),
    name,
    role: role as "client" | "designer",
    created_at: new Date().toISOString(),
  };

  store.users.push(user);

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return res;
}
