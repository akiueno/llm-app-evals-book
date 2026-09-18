import { NextResponse } from "next/server";
import { saveDraft } from "@/lib/db";
import { withInquiry } from "@/lib/api-helpers";

export const POST = (request: Request, context: { params: Promise<{ id: string }> }) =>
  withInquiry(request, context, (inquiry, body) => {
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

    const updated = saveDraft(inquiry.id, { subject, body: responseBody });

    return NextResponse.json({
      id: updated!.id,
      status: updated!.status,
      updated_at: updated!.updated_at,
    });
  });
