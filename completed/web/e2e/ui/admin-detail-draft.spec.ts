import { test, expect } from "@playwright/test";
import {
  createInquiry,
  waitForStatus,
  getInquiry,
  unique,
  gotoAdmin,
  openInquiryByName,
} from "../support/helpers";

test.describe("管理画面 詳細・下書き編集", () => {
  test("内容・品質チェックの表示と下書き保存", async ({ page, request }) => {
    const name = unique("下書き編集");
    const id = await createInquiry(request, {
      customer_name: name,
      customer_email: "draft-ui@example.com",
      company_name: "下書きUI株式会社",
      content: "下書き編集UIテスト用の問い合わせ本文です。",
    });
    await waitForStatus(request, id, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);

    // お問い合わせ内容カード
    await expect(page.getByText("お問い合わせ内容")).toBeVisible();
    await expect(page.getByText("draft-ui@example.com")).toBeVisible();
    await expect(page.getByText("下書き編集UIテスト用の問い合わせ本文です。")).toBeVisible();

    // 品質チェックカード（モック既定: politeness OK, confidence 91%）
    await expect(page.getByText("AI品質チェック")).toBeVisible();
    await expect(page.getByText("丁寧さ:")).toBeVisible();
    await expect(page.getByText("91%")).toBeVisible();

    // 下書き編集 → 保存
    await expect(page.locator("#edit-subject")).toBeVisible();
    await page.locator("#edit-body").fill("オペレーターが編集した本文です。");
    await page.getByRole("button", { name: "下書き保存" }).click();

    // 保存成功メッセージは再取得で即座にクリアされ得る（アプリ挙動）ため、
    // 永続化を API で決定的に検証する。
    await expect
      .poll(async () => (await getInquiry(request, id)).final_response?.body, {
        timeout: 10_000,
      })
      .toBe("オペレーターが編集した本文です。");
  });
});
