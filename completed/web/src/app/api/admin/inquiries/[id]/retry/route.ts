import { NextResponse } from "next/server";
import { after } from "next/server";
import { getInquiryById, markInquiryAsProcessing } from "@/lib/db";
import { runGenerateDraftJob } from "@/lib/generate-draft-job";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inquiry = getInquiryById(id);

    if (!inquiry) {
      return NextResponse.json(
        { error: "お問い合わせが見つかりません" },
        { status: 404 }
      );
    }

    if (inquiry.status !== "draft" && inquiry.status !== "error") {
      return NextResponse.json({ error: "下書きまたはエラー状態でのみ再生成できます" }, { status: 409 });
    }
    markInquiryAsProcessing(id);

    after(() =>
      runGenerateDraftJob({
        inquiryId: id,
        customer_name: inquiry.customer_name,
        company_name: inquiry.company_name,
        content: inquiry.content,
      })
    );

    return NextResponse.json({ message: "返信案の再生成を開始しました" });
  } catch (error) {
    console.error("Error retrying inquiry:", error);
    return NextResponse.json(
      { error: "返信案の再生成に失敗しました" },
      { status: 500 }
    );
  }
}
