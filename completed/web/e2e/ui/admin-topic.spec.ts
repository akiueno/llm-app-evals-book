import { test, expect } from "@playwright/test";
import {
  createInquiry,
  waitForStatus,
  unique,
  reseed,
  gotoAdmin,
  openInquiryByName,
  MARKERS,
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

  // モックLLMのマーカー応答（topic=spam / generated_draft=null / run_id あり）に依存するため @mock
  test("スパム再分類後に手動返信して送信できる", { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("スパム再分類");
    const id = await createInquiry(request, {
      customer_name: name,
      customer_email: "spam-reclass@example.com",
      content: `宣伝メールに見える問い合わせ。${MARKERS.SPAM}`,
    });
    await waitForStatus(request, id, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);

    // スパム判定中は返信フォームが表示されない
    await expect(
      page.getByText("このお問い合わせはスパムと判定されました。対応不要です。")
    ).toBeVisible();
    await expect(page.locator("#edit-subject")).toHaveCount(0);

    // 分類をプロダクトへ修正すると返信フォームが出現する
    const correctionSelect = page
      .getByRole("combobox")
      .filter({ hasText: "スパム" });
    await correctionSelect.click();
    await page.getByRole("option", { name: "プロダクト", exact: true }).click();

    await expect(page.getByText("分類が修正されました")).toBeVisible();
    await expect(page.locator("#edit-subject")).toBeVisible();

    // 手動で返信を作成して送信（確認ダイアログを承認）
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("#edit-subject").fill("再分類後の手動返信");
    await page
      .locator("#edit-body")
      .fill("お問い合わせいただきありがとうございます。担当者よりご案内いたします。");
    await page.getByRole("button", { name: "送信", exact: true }).click();

    // 送信済みの読み取り専用ビューへ遷移する
    await expect(page.getByText("再分類後の手動返信")).toBeVisible();
    await expect(page.getByText("送信済み").first()).toBeVisible();
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
