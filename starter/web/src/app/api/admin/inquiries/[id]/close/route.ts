import { NextResponse } from "next/server";
import { closeInquiry } from "@/lib/db";
import { withInquiry } from "@/lib/api-helpers";

export const POST = (request: Request, context: { params: Promise<{ id: string }> }) =>
  withInquiry(request, context, async (inquiry) => {
    if (inquiry.status !== "draft" || inquiry.topic !== "spam") {
      return NextResponse.json({ error: "下書き状態のスパムのみ終了できます" }, { status: 409 });
    }

    const updated = closeInquiry(inquiry);
    if (!updated) {
      return NextResponse.json({ error: "お問い合わせが更新されました。再確認してください" }, { status: 409 });
    }
    return NextResponse.json({ id: updated.id, status: updated.status, updated_at: updated.updated_at });
  });
