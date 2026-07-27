import { test, expect } from "@playwright/test";
import {
  createInquiry,
  waitForStatus,
  unique,
  reseed,
  gotoAdmin,
  openInquiryByName,
} from "../support/helpers";

test.describe("管理画面 分類修正", () => {
  test("分類を変更すると AI元分類が表示される", async ({ page, request }) => {
    const name = unique("分類修正UI");
    const id = await createInquiry(request, {
      customer_name: name,
      customer_email: "topic-ui@example.com",
      content: "分類修正UIテスト用の本文です。",
    });
    // モック既定で topic=development の下書きになる
    await waitForStatus(request, id, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);

    await expect(page.getByText("分類修正")).toBeVisible();
    // 分類修正の Select（現在値: 開発支援）を操作
    const correctionSelect = page
      .getByRole("combobox")
      .filter({ hasText: "開発支援" });
    await correctionSelect.click();
    await page.getByRole("option", { name: "プロダクト", exact: true }).click();

    // 楽観的更新で値が変わり、AI元分類が表示される
    await expect(page.getByText("AI元分類: 開発支援")).toBeVisible();
    await expect(
      page.getByRole("combobox").filter({ hasText: "プロダクト" })
    ).toBeVisible();
  });

  test("送信済みの問い合わせでは分類 Select が無効化される", async ({ page }) => {
    reseed();
    await gotoAdmin(page);
    // 鈴木 一郎: sent / development
    await openInquiryByName(page, "鈴木 一郎");
    await expect(page.getByText("分類修正")).toBeVisible();
    const correctionSelect = page
      .getByRole("combobox")
      .filter({ hasText: "開発支援" });
    await expect(correctionSelect).toBeDisabled();
  });
});
