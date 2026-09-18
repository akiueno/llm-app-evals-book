import { test, expect } from "@playwright/test";
import { createInquiry, getInquiry, waitForStatus, unique, gotoAdmin, openInquiryByName, MARKERS } from "../support/helpers";

for (const status of ["draft", "error"] as const) {
  test(`選択したまま処理中から${status}へ自動更新する`, { tag: "@mock" }, async ({ page, request }) => {
    const name = unique(`自動更新-${status}`);
    const id = await createInquiry(request, {
      customer_name: name, customer_email: "refresh@example.com",
      content: status === "error" ? `失敗する問い合わせ ${MARKERS.ERROR}` : "通常のお問い合わせです。",
    });
    await waitForStatus(request, id, status);
    const detail = await getInquiry(request, id);
    // 最初の詳細取得だけ処理中を返し、その後は実際の保存済み状態を取得する。
    await page.route(`**/api/admin/inquiries/${id}`, route => route.fulfill({
      json: { ...detail, status: "processing", generated_draft: null },
    }), { times: 1 });
    await gotoAdmin(page);
    await openInquiryByName(page, name);
    await expect(page.getByText("AI処理中", { exact: true })).toBeVisible();
    if (status === "draft") {
      await expect(page.locator("#edit-body")).toHaveValue(detail.generated_draft.body, { timeout: 12_000 });
    } else {
      await expect(page.getByText("返信案の生成に失敗しました", { exact: true })).toBeVisible({ timeout: 12_000 });
    }
    await expect(page.getByText("AI処理中", { exact: true })).toHaveCount(0);
  });
}

test("分類変更と定期更新で入力・保存メッセージを消さない", async ({ page, request }) => {
  const name = unique("入力保持");
  const id = await createInquiry(request, { customer_name: name, customer_email: "edit@example.com", content: "入力保持の問い合わせです。" });
  await waitForStatus(request, id, "draft");
  await gotoAdmin(page);
  await openInquiryByName(page, name);
  await page.locator("#edit-subject").fill("編集中の件名");
  await page.locator("#edit-body").fill("保存前の本文");
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "プロダクト", exact: true }).click();
  await expect(page.getByText("分類を変更しました", { exact: true })).toBeVisible();
  const polled = page.waitForResponse(r => r.url().endsWith(`/api/admin/inquiries/${id}`));
  await polled;
  await expect(page.locator("#edit-body")).toHaveValue("保存前の本文");
  await page.getByRole("button", { name: "下書き保存" }).click();
  await expect(page.getByText("下書きを保存しました", { exact: true })).toBeVisible();
  await expect.poll(async () => (await getInquiry(request, id)).final_response?.body).toBe("保存前の本文");
  await page.waitForResponse(r => r.url().endsWith(`/api/admin/inquiries/${id}`));
  await expect(page.getByText("下書きを保存しました", { exact: true })).toBeVisible();
});

test("一覧・詳細の取得エラーを表示し、成功後に解除する", async ({ page, request }) => {
  const name = unique("取得復帰");
  const id = await createInquiry(request, { customer_name: name, customer_email: "fetch@example.com", content: "取得エラーのテストです。" });
  await waitForStatus(request, id, "draft");
  await page.route("**/api/admin/inquiries?*", route => route.fulfill({ status: 503, json: { error: "一覧が一時停止中" } }), { times: 1 });
  await gotoAdmin(page);
  await expect(page.getByText("一覧が一時停止中")).toBeVisible();
  await expect(page.getByText("一覧が一時停止中")).toHaveCount(0, { timeout: 12_000 });
  await page.route(`**/api/admin/inquiries/${id}`, route => route.fulfill({ status: 503, json: { error: "詳細が一時停止中" } }), { times: 1 });
  await openInquiryByName(page, name);
  await expect(page.getByText("詳細が一時停止中")).toBeVisible();
  await expect(page.locator("#edit-body")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText("詳細が一時停止中")).toHaveCount(0);
});

test("分類変更失敗を表示し、入力と分類を保持して再試行できる", async ({ page, request }) => {
  const name = unique("分類失敗");
  const id = await createInquiry(request, { customer_name: name, customer_email: "topic@example.com", content: "分類変更失敗のテストです。" });
  await waitForStatus(request, id, "draft");
  await gotoAdmin(page);
  await openInquiryByName(page, name);
  await page.locator("#edit-body").fill("未保存の本文");
  await page.route(`**/api/admin/inquiries/${id}/topic`, route => route.fulfill({ status: 500, json: { error: "分類変更に失敗しました" } }), { times: 1 });
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "プロダクト", exact: true }).click();
  await expect(page.getByText("分類変更に失敗しました", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox").last()).toHaveText("開発支援");
  await expect(page.locator("#edit-body")).toHaveValue("未保存の本文");
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "プロダクト", exact: true }).click();
  await expect(page.getByText("分類を変更しました", { exact: true })).toBeVisible();
  await expect(page.getByText("分類変更に失敗しました", { exact: true })).toHaveCount(0);
});

test("再生成の失敗を表示して再試行できる", { tag: "@mock" }, async ({ page, request }) => {
  const name = unique("再生成失敗");
  const id = await createInquiry(request, { customer_name: name, customer_email: "retry@example.com", content: `失敗する問い合わせ ${MARKERS.ERROR}` });
  await waitForStatus(request, id, "error");
  await gotoAdmin(page);
  await openInquiryByName(page, name);
  await page.route(`**/api/admin/inquiries/${id}/retry`, route => route.fulfill({ status: 503, json: { error: "再生成APIが一時停止中" } }), { times: 1 });
  await page.getByRole("button", { name: "返信案を再生成" }).click();
  await expect(page.getByText("再生成APIが一時停止中")).toBeVisible();
  await page.getByRole("button", { name: "返信案を再生成" }).click();
  await expect(page.getByText("再生成APIが一時停止中")).toHaveCount(0);
});

test("古い詳細レスポンスが新しい選択を上書きしない", async ({ page, request }) => {
  const first = unique("古い選択");
  const second = unique("新しい選択");
  const a = await createInquiry(request, { customer_name: first, customer_email: "first@example.com", content: "最初の問い合わせです。" });
  const b = await createInquiry(request, { customer_name: second, customer_email: "second@example.com", content: "次の問い合わせです。" });
  await waitForStatus(request, a, "draft");
  await waitForStatus(request, b, "draft");
  const detail = await getInquiry(request, a);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/admin/inquiries/${a}`, async route => { await held; await route.fulfill({ json: detail }); });
  await gotoAdmin(page);
  const started = page.waitForRequest(r => r.url().endsWith(`/api/admin/inquiries/${a}`));
  await openInquiryByName(page, first);
  await started;
  await openInquiryByName(page, second);
  await expect(page.getByText("second@example.com")).toBeVisible();
  const finished = page.waitForResponse(r => r.url().endsWith(`/api/admin/inquiries/${a}`));
  release();
  await finished;
  await expect(page.getByText("first@example.com")).toHaveCount(0);
  await expect(page.getByText("second@example.com")).toBeVisible();
});
