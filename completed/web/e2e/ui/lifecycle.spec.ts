import { test, expect } from "@playwright/test";
import {
  submitContactForm,
  findInquiryIdByName,
  waitForStatus,
  unique,
  gotoAdmin,
  openInquiryByName,
  MARKERS,
} from "../support/helpers";

// モックLLMのマーカー応答に依存するため @mock（実APIモードでは除外）
test.describe("問い合わせライフサイクル（フォーム→AI生成→管理画面）", () => {
  test("正常系: 送信後に下書きが生成される", { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("ライフサイクル正常");
    await submitContactForm(page, {
      customer_name: name,
      customer_email: "lifecycle-ok@example.com",
      content: "通常の問い合わせ。下書きが生成されます。",
    });
    const id = await findInquiryIdByName(request, name);
    expect(id).not.toBeNull();
    await waitForStatus(request, id!, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);
    await expect(page.getByText("AI品質チェック")).toBeVisible();
    await expect(page.getByText("丁寧さ:")).toBeVisible();
    await expect(page.locator("#edit-subject")).toBeVisible();
  });

  test("スパム検知: 下書きは生成されず対応不要表示", { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("ライフサイクルスパム");
    await submitContactForm(page, {
      customer_name: name,
      customer_email: "lifecycle-spam@example.com",
      content: `宣伝メールです。${MARKERS.SPAM}`,
    });
    const id = await findInquiryIdByName(request, name);
    await waitForStatus(request, id!, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);
    await expect(page.getByText("スパム検知")).toBeVisible();
    await expect(
      page.getByText("このお問い合わせはスパムと判定されました。対応不要です。")
    ).toBeVisible();
    // 下書き編集UIは表示されない
    await expect(page.locator("#edit-subject")).toHaveCount(0);
  });

  test("品質NG: 品質要注意バッジと丁寧さNGを表示", { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("ライフサイクルNG");
    await submitContactForm(page, {
      customer_name: name,
      customer_email: "lifecycle-ng@example.com",
      content: `ぞんざいな依頼。${MARKERS.NG}`,
    });
    const id = await findInquiryIdByName(request, name);
    await waitForStatus(request, id!, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);
    await expect(page.getByText("品質要注意")).toBeVisible();
    await expect(page.getByText("NG", { exact: true })).toBeVisible();
  });

  test("エラー系: 生成失敗のエラー表示と再生成", { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("ライフサイクルエラー");
    await submitContactForm(page, {
      customer_name: name,
      customer_email: "lifecycle-error@example.com",
      content: `生成失敗させる。${MARKERS.ERROR}`,
    });
    const id = await findInquiryIdByName(request, name);
    await waitForStatus(request, id!, "error");

    await gotoAdmin(page);
    await openInquiryByName(page, name);
    await expect(page.getByText("返信案の生成に失敗しました")).toBeVisible();
    const retryButton = page.getByRole("button", { name: "返信案を再生成" });
    await expect(retryButton).toBeEnabled();

    // 再生成を実行 → 同じマーカーのため再びエラーで終わる（パイプライン再実行を確認）
    await retryButton.click();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row.getByText("エラー", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
