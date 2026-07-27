import { test, expect } from "@playwright/test";
import { reseed, FIXTURES } from "../support/helpers";

// 既知のシードデータに依存する read 系テスト
test.describe("GET /api/admin/inquiries（一覧・フィルタ・ページング）", () => {
  test.beforeAll(() => {
    reseed();
  });

  test("シード済みの全件を返す", async ({ request }) => {
    const res = await request.get("/api/admin/inquiries?limit=100");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.total).toBe(FIXTURES.total);
    expect(data.items.length).toBe(FIXTURES.total);
    expect(data.limit).toBe(100);
    expect(data.offset).toBe(0);
  });

  test("created_at 降順で並ぶ", async ({ request }) => {
    const res = await request.get("/api/admin/inquiries?limit=100");
    const { items } = await res.json();
    const times = items.map((i: { created_at: string }) => i.created_at);
    const sorted = [...times].sort().reverse();
    expect(times).toEqual(sorted);
  });

  test("status フィルタ（draft / sent）", async ({ request }) => {
    const draft = await (await request.get("/api/admin/inquiries?status=draft&limit=100")).json();
    expect(draft.total).toBe(FIXTURES.byStatus.draft);
    expect(draft.items.every((i: { status: string }) => i.status === "draft")).toBeTruthy();

    const sent = await (await request.get("/api/admin/inquiries?status=sent&limit=100")).json();
    expect(sent.total).toBe(FIXTURES.byStatus.sent);
  });

  test("topic フィルタ（development / spam）", async ({ request }) => {
    const dev = await (await request.get("/api/admin/inquiries?topic=development&limit=100")).json();
    expect(dev.total).toBe(FIXTURES.byTopic.development);

    const spam = await (await request.get("/api/admin/inquiries?topic=spam&limit=100")).json();
    expect(spam.total).toBe(FIXTURES.byTopic.spam);
    expect(spam.items[0].topic).toBe("spam");
  });

  test("status と topic の複合フィルタ（AND）", async ({ request }) => {
    const res = await request.get("/api/admin/inquiries?status=draft&topic=development&limit=100");
    const data = await res.json();
    // 高橋（draft/development/NG）の1件
    expect(data.total).toBe(1);
    expect(data.items[0].quality_alert).toBe(true);
  });

  test("limit / offset でページングできる", async ({ request }) => {
    const page1 = await (await request.get("/api/admin/inquiries?limit=2&offset=0")).json();
    const page2 = await (await request.get("/api/admin/inquiries?limit=2&offset=2")).json();
    expect(page1.total).toBe(FIXTURES.total);
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(2);
    const ids1 = page1.items.map((i: { id: string }) => i.id);
    const ids2 = page2.items.map((i: { id: string }) => i.id);
    expect(ids1).not.toEqual(ids2);
  });
});

test.describe("GET /api/admin/inquiries/[id]（詳細）", () => {
  test.beforeAll(() => {
    reseed();
  });

  test("存在するIDで詳細を返す", async ({ request }) => {
    const list = await (await request.get("/api/admin/inquiries?status=sent&limit=1")).json();
    const id = list.items[0].id;
    const res = await request.get(`/api/admin/inquiries/${id}`);
    expect(res.ok()).toBeTruthy();
    const inq = await res.json();
    expect(inq.id).toBe(id);
    expect(inq.status).toBe("sent");
    expect(inq.final_response).not.toBeNull();
    expect(inq.customer_email).toBeTruthy();
  });

  test("存在しないIDは 404", async ({ request }) => {
    const res = await request.get("/api/admin/inquiries/inq_does_not_exist");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("お問い合わせが見つかりません");
  });
});
