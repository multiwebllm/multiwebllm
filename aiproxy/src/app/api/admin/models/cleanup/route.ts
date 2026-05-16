import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import { deleteUnrelatedModels } from "@/lib/models/cleanup";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await deleteUnrelatedModels();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
