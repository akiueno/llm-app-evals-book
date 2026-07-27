import { test, expect } from "@playwright/test";
import {
  createInquiry,
  waitForStatus,
  unique,
  gotoAdmin,
  openInquiryByName,
} from "../support/helpers";

test.describe("管理画面 送信フロー", () => {
  test("確認ダイアログを承認して送信し、送信済みビューになる", async ({ page, request }) => {
    const name = unique("送信フロー");
    const id = await createInquiry(request, {
      customer_name: name,
      customer_email: "send-ui@example.com",
      content: "送信フローUIテスト用の本文です。",
    });
    await waitForStatus(request, id, "draft");

    await gotoAdmin(page);
    await openInquiryByName(page, name);

    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.locator("#edit-subject").fill("送信する件名");
    await page.locator("#edit-body").fill("送信する本文です。");
    await page.getByRole("button", { name: "送信", exact: true }).click();

    // 送信済みの読み取り専用ビュー
    await expect(page.getByText("件名:")).toBeVisible();
    await expect(page.getByText("本文:")).toBeVisible();
    await expect(page.getByText("送信する件名")).toBeVisible();
    await expect(page.getByText("送信済み").first()).toBeVisible();

    expect(dialogMessage).toContain("この内容でメールを送信します");
  });
});
