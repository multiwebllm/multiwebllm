import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import { checkProviderHealth } from "@/lib/provider-health";
import { getCookieReloginRemindDays, readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const providerId = parseInt(id, 10);
  if (isNaN(providerId)) {
    return NextResponse.json(
      { ok: false, message: "无效的服务商 ID" },
      { status: 400 }
    );
  }

  const settings = await readSettings();
  const result = await checkProviderHealth(providerId, {
    reloginRemindDays: getCookieReloginRemindDays(settings),
    updateDb: true,
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, message: "服务商不存在" },
      { status: 404 }
    );
  }

  if (result.skipped) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: 400 }
    );
  }

  if (result.ok && !result.needsRelogin) {
    return NextResponse.json({
      ok: true,
      message: result.message,
      authAgeDays: result.authAgeDays,
    });
  }

  if (result.ok && result.needsRelogin) {
    return NextResponse.json({
      ok: true,
      message: result.message,
      authAgeDays: result.authAgeDays,
      needsRelogin: true,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: result.message,
      authAgeDays: result.authAgeDays,
      needsRelogin: result.needsRelogin,
    },
    { status: 422 }
  );
}
