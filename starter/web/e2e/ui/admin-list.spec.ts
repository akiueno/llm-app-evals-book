import { test, expect } from "@playwright/test";
import { reseed, chooseFilter, gotoAdmin } from "../support/helpers";

test.describe("管理画面 一覧・フィルタ", () => {
  test.beforeEach(() => {
    reseed();
  });

  test("シード済みの問い合わせが一覧に表示される", async ({ page }) => {
    await gotoAdmin(page);
    await expect(page.getByText("鈴木 一郎")).toBeVisible();
    await expect(page.getByText("佐藤 健太")).toBeVisible();
    await expect(page.getByText("田村 健一")).toBeVisible();
    // テーブルヘッダ
    await expect(page.getByRole("columnheader", { name: "顧客名" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "ステータス" })).toBeVisible();
  });

  test("ステータスフィルタ（下書き）で絞り込める", async ({ page }) => {
    await gotoAdmin(page);
    await chooseFilter(page, 0, "下書き");
    // 下書きの佐藤は表示、送信済みの鈴木は非表示
    await expect(page.getByText("佐藤 健太")).toBeVisible();
    await expect(page.getByText("鈴木 一郎")).toHaveCount(0);
  });

  test("分類フィルタ（スパム）で絞り込める", async ({ page }) => {
    await gotoAdmin(page);
    await chooseFilter(page, 1, "スパム");
    await expect(page.getByText("田村 健一")).toBeVisible();
    await expect(page.getByText("佐藤 健太")).toHaveCount(0);
  });

  test("該当なしのフィルタで空状態を表示する", async ({ page }) => {
    await gotoAdmin(page);
    // シードに error は存在しない
    await chooseFilter(page, 0, "エラー");
    await expect(page.getByText("お問い合わせがありません")).toBeVisible();
  });

  test("行をクリックすると詳細が表示される", async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole("row").filter({ hasText: "佐藤 健太" }).first().click();
    await expect(page.getByText("お問い合わせ内容")).toBeVisible();
    await expect(page.getByText("sato@example.com")).toBeVisible();
  });
});
