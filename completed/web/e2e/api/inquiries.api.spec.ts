import { test, expect } from "@playwright/test";
import { unique } from "../support/helpers";

test.describe("POST /api/inquiries", () => {
  test("有効な入力で 200 と受付メッセージを返す", async ({ request }) => {
    const name = unique("作成成功");
    const res = await request.post("/api/inquiries", {
      data: {
        customer_name: name,
        customer_email: "create@example.com",
        company_name: "テスト株式会社",
        content: "APIから作成した問い合わせです。",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("お問い合わせを受け付けました");
  });

  test("company_name は任意（省略しても 200）", async ({ request }) => {
    const res = await request.post("/api/inquiries", {
      data: {
        customer_name: unique("会社名なし"),
        customer_email: "nocompany@example.com",
        content: "会社名なしの問い合わせ。",
      },
    });
    expect(res.status()).toBe(200);
  });

  for (const missing of ["customer_name", "customer_email", "content"]) {
    test(`必須項目 ${missing} が欠落すると 400`, async ({ request }) => {
      const data: Record<string, string> = {
        customer_name: unique("欠落"),
        customer_email: "missing@example.com",
        content: "本文",
      };
      delete data[missing];
      const res = await request.post("/api/inquiries", { data });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("必須項目が入力されていません");
    });
  }
});
