/**
 * E2E 共通ヘルパー。
 *  - 一意な問い合わせの作成とID解決
 *  - 非同期な AI 生成完了（status 遷移）のポーリング待機
 *  - DB 再シード
 *  - UI 文字列/ラベル定数
 */
import { APIRequestContext, expect, Page } from "@playwright/test";
import { seedDatabase, e2eDbPath } from "./seed";

export { MARKERS } from "./markers";
export { FIXTURES } from "./seed";

/** db.ts / constants.ts と一致するラベル定義。 */
export const STATUS_LABELS = {
  processing: "処理中",
  draft: "下書き",
  sent: "送信済み",
  error: "エラー",
} as const;

export const TOPIC_LABELS = {
  development: "開発支援",
  product: "プロダクト",
  other: "その他",
  spam: "スパム",
} as const;

export type Status = keyof typeof STATUS_LABELS;
export type Topic = keyof typeof TOPIC_LABELS;

let counter = 0;
/** テストごとに一意な識別子を生成する。 */
export function unique(prefix = "E2E"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** DBを既知のシードデータへ戻す（read系テストの beforeAll 用）。 */
export function reseed(): void {
  seedDatabase(e2eDbPath());
}

interface NewInquiry {
  customer_name: string;
  customer_email: string;
  company_name?: string;
  content: string;
}

/** 一覧API(customer_name 一致)から問い合わせIDを解決する。 */
export async function findInquiryIdByName(
  request: APIRequestContext,
  customerName: string
): Promise<string | null> {
  const res = await request.get(`/api/admin/inquiries?limit=100`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const item = (data.items as { id: string; customer_name: string }[]).find(
    (i) => i.customer_name === customerName
  );
  return item?.id ?? null;
}

/** 問い合わせを作成し、解決したIDを返す（customer_name は一意であること）。 */
export async function createInquiry(
  request: APIRequestContext,
  data: NewInquiry
): Promise<string> {
  const res = await request.post(`/api/inquiries`, { data });
  expect(res.status(), await res.text()).toBe(200);

  let id: string | null = null;
  await expect
    .poll(async () => {
      id = await findInquiryIdByName(request, data.customer_name);
      return id;
    }, { timeout: 10_000, message: `inquiry "${data.customer_name}" not found` })
    .not.toBeNull();

  return id!;
}

/** 問い合わせ詳細を取得する。 */
export async function getInquiry(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/admin/inquiries/${id}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

/** 指定 status になるまでポーリングして待機する（非同期AI生成の完了待ち）。 */
export async function waitForStatus(
  request: APIRequestContext,
  id: string,
  status: Status,
  timeout = 20_000
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/admin/inquiries/${id}`);
        if (!res.ok()) return "(fetch-failed)";
        const inq = await res.json();
        return inq.status as string;
      },
      { timeout, message: `inquiry ${id} did not reach status "${status}"` }
    )
    .toBe(status);
}

/** AI生成が完了して processing を抜けるまで待つ（draft か error）。 */
export async function waitUntilProcessed(
  request: APIRequestContext,
  id: string,
  timeout = 20_000
): Promise<string> {
  let last = "processing";
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/admin/inquiries/${id}`);
        if (!res.ok()) return "processing";
        const inq = await res.json();
        last = inq.status as string;
        return last;
      },
      { timeout, message: `inquiry ${id} stuck in processing` }
    )
    .not.toBe("processing");
  return last;
}

/** 公開フォームから問い合わせを送信する（成功カードの表示まで待つ）。 */
export async function submitContactForm(page: Page, data: NewInquiry): Promise<void> {
  await page.goto("/");
  await page.locator("#customer_name").fill(data.customer_name);
  await page.locator("#customer_email").fill(data.customer_email);
  if (data.company_name) await page.locator("#company_name").fill(data.company_name);
  await page.locator("#content").fill(data.content);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("送信完了")).toBeVisible();
}

/** 管理画面で customer_name の行を選択して詳細を開く。 */
export async function openInquiryByName(page: Page, customerName: string) {
  const row = page.getByRole("row").filter({ hasText: customerName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
}

/**
 * 左パネルのフィルタ Select（Radix）を操作する。
 * index 0 = ステータス, 1 = 分類（詳細未選択時はこの2つのみ存在）。
 */
export async function chooseFilter(page: Page, index: 0 | 1, optionLabel: string) {
  await page.getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

/** 管理画面を開き、一覧が描画されるまで待つ。 */
export async function gotoAdmin(page: Page) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "お問い合わせ管理" })).toBeVisible({
    timeout: 15_000,
  });
}
