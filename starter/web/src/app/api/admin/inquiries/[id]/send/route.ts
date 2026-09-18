import { NextResponse } from "next/server";
import { markAsSent } from "@/lib/db";
import { withInquiry } from "@/lib/api-helpers";

export const POST = (request: Request, context: { params: Promise<{ id: string }> }) =>
  withInquiry(request, context, async (inquiry, body) => {
    if (inquiry.status !== "draft") {
      return NextResponse.json({ error: "下書き状態でのみ操作できます" }, { status: 409 });
    }
    if (inquiry.topic === "spam") {
      return NextResponse.json({ error: "返信するにはスパム以外に分類を変更してください" }, { status: 409 });
    }
    const { subject, body: responseBody } = body as { subject?: string; body?: string };

    if (!subject || !responseBody) {
      return NextResponse.json(
        { error: "件名と本文は必須です" },
        { status: 400 },
      );
    }

    const updated = markAsSent(inquiry.id, {
      subject,
      body: responseBody,
      edit_distance: null,
      operator_edited_topic: null,
      expected_updated_at: inquiry.updated_at,
    });

    if (!updated) return NextResponse.json({ error: "お問い合わせが更新されました。再確認してください" }, { status: 409 });

    return NextResponse.json({
      id: updated!.id,
      status: updated!.status,
      sent_at: updated!.sent_at,
    });
  });
