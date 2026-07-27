import { test, expect } from "@playwright/test";

test.describe("GET /api/health", () => {
  test("LLMバックエンド稼働時は 200 を返す", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
