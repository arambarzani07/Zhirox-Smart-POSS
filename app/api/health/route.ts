import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, app: "zhirox-smart-pos", architecture: "fresh-v1" }, { status: 200 });
}
