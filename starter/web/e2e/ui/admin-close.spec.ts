import { test, expect } from "@playwright/test";
import { createInquiry, getInquiry, waitForStatus, unique, gotoAdmin, openInquiryByName, chooseFilter, MARKERS } from "../support/helpers";

for (const originalSpam of [true, false]) {
  test(`スパムを終了し、再読込とフィルタで確認できる（元スパム=${originalSpam}）`, { tag: "@mock" }, async ({ page, request }) => {
    const name = unique("終了確認");
    const id = await createInquiry(request, { customer_name: name, customer_email: "close@example.com", content: originalSpam ? `営業メールです ${MARKERS.SPAM}` : "通常のお問い合わせです。" });
    await waitForStatus(request, id, "draft");
    await gotoAdmin(page);
    await openInquiryByName(page, name);
    if (!originalSpam) {
      await page.locator("#edit-body").fill("破棄される下書き");
      await page.getByRole("button", { name: "下書き保存" }).click();
      await expect(page.getByText("下書きを保存しました", { exact: true })).toBeVisible();
      await page.getByRole("combobox").last().click();
      await page.getByRole("option", { name: "スパム", exact: true }).click();
    }
    await expect(page.locator("#edit-body")).toHaveCount(0);
    page.on("dialog", dialog => dialog.accept());
    const countUrl = `http://localhost:${process.env.MOCK_LLM_PORT ?? 8787}/test/feedback-count`;
    const before = await (await request.get(countUrl)).json();
    await page.getByRole("button", { name: "対応不要として終了", exact: true }).click();
    await expect(page.getByText("終了（対応不要）", { exact: true })).toBeVisible();
    await expect(page.getByText("対応不要として終了しました", { exact: true })).toBeVisible();
    const after = await (await request.get(countUrl)).json();
    expect(after.count).toBe(before.count);
    const detail = await getInquiry(request, id);
    expect(detail.status).toBe("closed");
    expect(detail.sent_at).toBeNull();
    expect(detail.final_response).toBeNull();
    expect(detail.edit_distance).toBeNull();
    expect(detail.operator_edited_topic).toBe(!originalSpam);
    await page.reload();
    await chooseFilter(page, 0, "終了");
    await openInquiryByName(page, name);
    await expect(page.getByText("終了（対応不要）", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox").last()).toBeDisabled();
    await expect(page.getByRole("button", { name: "対応不要として終了", exact: true })).toHaveCount(0);
    for (const endpoint of ["draft", "send", "topic", "retry", "close"]) {
      const result = await request.post(`/api/admin/inquiries/${id}/${endpoint}`, { data: { subject: "件名", body: "本文", topic: "development" } });
      expect(result.status(), endpoint).toBe(409);
    }
    expect((await getInquiry(request, id)).status).toBe("closed");
  });
}

test("通常分類の終了とスパムへの返信は拒否する", { tag: "@mock" }, async ({ request }) => {
  const id = await createInquiry(request, { customer_name: unique("遷移制限"), customer_email: "guard@example.com", content: "通常の問い合わせです。" });
  await waitForStatus(request, id, "draft");
  expect((await request.post(`/api/admin/inquiries/${id}/close`)).status()).toBe(409);
  await request.post(`/api/admin/inquiries/${id}/topic`, { data: { topic: "spam" } });
  for (const endpoint of ["draft", "send"]) {
    expect((await request.post(`/api/admin/inquiries/${id}/${endpoint}`, { data: { subject: "件名", body: "本文" } })).status()).toBe(409);
  }
});

test("終了操作が失敗したら理由を表示し下書きのまま再試行できる", { tag: "@mock" }, async ({ page, request }) => {
  const name = unique("終了失敗");
  const id = await createInquiry(request, { customer_name: name, customer_email: "close-fail@example.com", content: `営業メール ${MARKERS.SPAM}` });
  await waitForStatus(request, id, "draft");
  await gotoAdmin(page);
  await openInquiryByName(page, name);
  await page.route(`**/api/admin/inquiries/${id}/close`, route => route.fulfill({ status: 503, json: { error: "終了処理を一時的に利用できません" } }), { times: 1 });
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "対応不要として終了", exact: true }).click();
  await expect(page.getByText("終了処理を一時的に利用できません", { exact: true })).toBeVisible();
  expect((await getInquiry(request, id)).status).toBe("draft");
  await page.getByRole("button", { name: "対応不要として終了", exact: true }).click();
  await expect(page.getByText("終了（対応不要）", { exact: true })).toBeVisible();
});
