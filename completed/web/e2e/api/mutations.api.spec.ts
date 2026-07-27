import { test, expect, APIRequestContext } from "@playwright/test";
import {
  createInquiry,
  getInquiry,
  unique,
  waitForStatus,
  waitUntilProcessed,
} from "../support/helpers";

/** 下書き状態まで進んだ問い合わせを作成して返す。 */
async function createDraftInquiry(request: APIRequestContext, label: string): Promise<string> {
  const id = await createInquiry(request, {
    customer_name: unique(label),
    customer_email: "mutation@example.com",
    content: "通常の問い合わせ内容です。下書きが生成されます。",
  });
  await waitForStatus(request, id, "draft");
  return id;
}

test.describe("POST /api/admin/inquiries/[id]/draft（下書き保存）", () => {
  test("件名と本文を保存して status=draft を維持する", async ({ request }) => {
    const id = await createDraftInquiry(request, "下書き保存");
    const res = await request.post(`/api/admin/inquiries/${id}/draft`, {
      data: { subject: "編集した件名", body: "編集した本文です。" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.status).toBe("draft");
    expect(body.updated_at).toBeTruthy();

    const inq = await getInquiry(request, id);
    expect(inq.final_response).toEqual({ subject: "編集した件名", body: "編集した本文です。" });
  });

  test("件名・本文が欠けると 400", async ({ request }) => {
    const id = await createDraftInquiry(request, "下書き検証");
    const res = await request.post(`/api/admin/inquiries/${id}/draft`, {
      data: { subject: "件名のみ" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("件名と本文は必須です");
  });

  test("存在しないIDは 404", async ({ request }) => {
    const res = await request.post(`/api/admin/inquiries/inq_missing/draft`, {
      data: { subject: "x", body: "y" },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("お問い合わせが見つかりません");
  });
});

test.describe("POST /api/admin/inquiries/[id]/send（送信）", () => {
  test("送信すると status=sent と sent_at が設定される", async ({ request }) => {
    const id = await createDraftInquiry(request, "送信");
    const res = await request.post(`/api/admin/inquiries/${id}/send`, {
      data: { subject: "送信件名", body: "送信本文です。" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("sent");
    expect(body.sent_at).toBeTruthy();

    const inq = await getInquiry(request, id);
    expect(inq.status).toBe("sent");
    expect(inq.sent_at).not.toBeNull();
    expect(inq.final_response).toEqual({ subject: "送信件名", body: "送信本文です。" });
  });

  test("件名・本文が欠けると 400", async ({ request }) => {
    const id = await createDraftInquiry(request, "送信検証");
    const res = await request.post(`/api/admin/inquiries/${id}/send`, {
      data: { body: "本文のみ" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("件名と本文は必須です");
  });
});

test.describe("POST /api/admin/inquiries/[id]/topic（分類修正）", () => {
  test("有効な分類に更新できる", async ({ request }) => {
    const id = await createDraftInquiry(request, "分類修正");
    const res = await request.post(`/api/admin/inquiries/${id}/topic`, {
      data: { topic: "product" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.topic).toBe("product");
    expect(body.updated_at).toBeTruthy();
  });

  test("無効な分類は 400", async ({ request }) => {
    const id = await createDraftInquiry(request, "分類無効");
    const res = await request.post(`/api/admin/inquiries/${id}/topic`, {
      data: { topic: "invalid_topic" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("有効な分類を指定してください");
  });

  test("存在しないIDは 404", async ({ request }) => {
    const res = await request.post(`/api/admin/inquiries/inq_missing/topic`, {
      data: { topic: "product" },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("POST /api/admin/inquiries/[id]/retry（再生成）", () => {
  test("再生成を開始し、再び draft へ遷移する", async ({ request }) => {
    const id = await createDraftInquiry(request, "再生成");
    const res = await request.post(`/api/admin/inquiries/${id}/retry`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).message).toBe("返信案の再生成を開始しました");
    // パイプラインが再実行され processing を抜ける
    await waitUntilProcessed(request, id);
  });

  test("存在しないIDは 404", async ({ request }) => {
    const res = await request.post(`/api/admin/inquiries/inq_missing/retry`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("お問い合わせが見つかりません");
  });
});
