import { test, expect } from "@playwright/test";

test.describe("FastAPI ヘルスチェックモーダル", () => {
  test("ヘルスチェックが失敗するとエラーモーダルを表示する", async ({ page }) => {
    // クライアントが叩く /api/health を 503 にスタブ
    await page.route("**/api/health", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ status: "error", message: "down" }),
      })
    );

    await page.goto("/");

    await expect(page.getByText("FastAPI接続エラー")).toBeVisible();
    await expect(
      page.getByText("FastAPIに接続できません。返信案生成機能が利用できない状態です。")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "再読み込み" })).toBeVisible();
  });

  test("ヘルスチェックが正常ならモーダルは出ない", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("お問い合わせフォーム", { exact: true })).toBeVisible();
    await expect(page.getByText("FastAPI接続エラー")).toHaveCount(0);
  });
});
