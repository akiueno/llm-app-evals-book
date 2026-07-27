import { test, expect } from "@playwright/test";

test.describe("ヘッダーナビゲーション", () => {
  test("トップ→管理画面→トップへ遷移できる", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("お問い合わせフォーム", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "管理画面" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "お問い合わせ管理" })).toBeVisible();

    await page.getByRole("link", { name: "トップ" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("お問い合わせフォーム", { exact: true })).toBeVisible();
  });
});
