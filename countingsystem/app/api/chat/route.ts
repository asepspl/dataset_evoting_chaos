import { NextResponse } from "next/server";

// Fitur AI Chat telah dihapus.
export async function POST() {
  return NextResponse.json(
    { error: "Fitur ini tidak tersedia." },
    { status: 410 } // 410 Gone — endpoint dihapus secara permanen
  );
}
