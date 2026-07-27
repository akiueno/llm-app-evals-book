import { test, expect } from "@playwright/test";
import { unique } from "../support/helpers";

test.describe("公開お問い合わせフォーム", () => {
  test("フォームの主要素が描画される", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "株式会社サンプルエージェント" })
    ).toBeVisible();
    await expect(page.getByText("お問い合わせフォーム", { exact: true })).toBeVisible();
    await expect(page.locator("#customer_name")).toBeVisible();
    await expect(page.locator("#customer_email")).toBeVisible();
    await expect(page.locator("#company_name")).toBeVisible();
    await expect(page.locator("#content")).toBeVisible();
    await expect(page.getByRole("button", { name: "送信する" })).toBeVisible();
  });

  test("送信に成功すると完了カードが表示され、再入力で初期化される", async ({ page }) => {
    await page.goto("/");
    await page.locator("#customer_name").fill(unique("送信成功"));
    await page.locator("#customer_email").fill("success@example.com");
    await page.locator("#company_name").fill("成功株式会社");
    await page.locator("#content").fill("フォームからの正常な問い合わせです。");
    await page.getByRole("button", { name: "送信する" }).click();

    await expect(page.getByText("送信完了")).toBeVisible();
    await expect(
      page.getByText("お問い合わせを受け付けました。担当者より順次ご連絡いたします。")
    ).toBeVisible();

    await page.getByRole("button", { name: "新しいお問い合わせ" }).click();
    await expect(page.getByText("お問い合わせフォーム", { exact: true })).toBeVisible();
    await expect(page.locator("#customer_name")).toHaveValue("");
    await expect(page.locator("#content")).toHaveValue("");
  });

  test("必須項目が空だと HTML5 バリデーションで送信されない", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "送信する" }).click();
    // 送信完了にならず、フォームのまま
    await expect(page.getByText("送信完了")).toHaveCount(0);
    const nameValid = await page
      .locator("#customer_name")
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(nameValid).toBe(false);
  });

  test("不正なメール形式は送信されない", async ({ page }) => {
    await page.goto("/");
    await page.locator("#customer_name").fill("メール検証");
    await page.locator("#customer_email").fill("not-an-email");
    await page.locator("#content").fill("本文");
    await page.getByRole("button", { name: "送信する" }).click();
    await expect(page.getByText("送信完了")).toHaveCount(0);
    const emailValid = await page
      .locator("#customer_email")
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(emailValid).toBe(false);
  });

  test("API がエラーを返すとエラーアラートを表示する", async ({ page }) => {
    await page.route("**/api/inquiries", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "サーバ側エラーです" }),
      })
    );
    await page.goto("/");
    await page.locator("#customer_name").fill("エラー検証");
    await page.locator("#customer_email").fill("error@example.com");
    await page.locator("#content").fill("本文");
    await page.getByRole("button", { name: "送信する" }).click();

    await expect(page.getByText("エラー", { exact: true })).toBeVisible();
    await expect(page.getByText("サーバ側エラーです")).toBeVisible();
    await expect(page.getByText("送信完了")).toHaveCount(0);
  });
});
