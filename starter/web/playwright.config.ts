import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * E2E 設定。
 *
 * 既定（モック）構成:
 *   - モックLLMサーバ(:8787) を起動し Next の LLM_API_URL を向ける
 *   - Next は専用DB(INQUIRIES_DB_PATH=data/e2e.db) を使用し開発DBを汚さない
 *
 * 実APIモード (E2E_REAL_LLM=1):
 *   - モックを起動せず LLM_API_URL=http://localhost:8000 を使用
 *   - マーカー依存の決定的テスト(@mock) は grepInvert で除外
 *
 * 詳細は web/e2e/README.md を参照。
 */
const USE_REAL_LLM = !!process.env.E2E_REAL_LLM;
const MOCK_LLM_PORT = Number(process.env.MOCK_LLM_PORT ?? 8787);
const LLM_API_URL = USE_REAL_LLM
  ? process.env.LLM_API_URL ?? "http://localhost:8000"
  : `http://localhost:${MOCK_LLM_PORT}`;
const E2E_DB_PATH = path.resolve(__dirname, "data", "e2e.db");
const BASE_URL = "http://localhost:3000";

const nextServer = {
  command: "npm run dev",
  url: BASE_URL,
  timeout: 120_000,
  reuseExistingServer: !process.env.CI,
  stdout: "pipe" as const,
  stderr: "pipe" as const,
  env: {
    LLM_API_URL,
    INQUIRIES_DB_PATH: E2E_DB_PATH,
  },
};

const mockServer = {
  command: "npx tsx e2e/support/mock-llm.ts",
  url: `http://localhost:${MOCK_LLM_PORT}/api/health`,
  timeout: 30_000,
  reuseExistingServer: !process.env.CI,
  stdout: "pipe" as const,
  stderr: "pipe" as const,
  env: {
    MOCK_LLM_PORT: String(MOCK_LLM_PORT),
  },
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/support/global-setup.ts",
  // 実APIモードではマーカー駆動のモック専用テストを除外
  grepInvert: USE_REAL_LLM ? /@mock/ : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "ja-JP",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: USE_REAL_LLM ? [nextServer] : [mockServer, nextServer],
});
