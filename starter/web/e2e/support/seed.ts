/**
 * 任意のDBパスへ scripts/seed-data.yaml の内容を投入する再利用シード関数。
 * scripts/seed.ts と同じスキーマ・変換ロジックを用いる（DELETE してから INSERT）。
 *
 * read 系/フィルタ/ページングテストの beforeAll から呼び、決定的な既知データを用意する。
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import yaml from "js-yaml";

interface ResponseEntry {
  subject: string;
  body: string;
  quality_scores?: { politeness: string; politeness_reason: string };
}

interface SeedEntry {
  customer_name: string;
  customer_email: string;
  company_name: string | null;
  content: string;
  status: "processing" | "draft" | "sent";
  topic: string | null;
  original_topic: string | null;
  operator_edited_topic: boolean;
  classification_confidence: number | null;
  quality_alert: boolean;
  edit_distance: number | null;
  minutes_ago: number;
  updated_minutes_ago: number;
  sent_minutes_ago: number | null;
  ai_response: ResponseEntry | null;
  final_response: ResponseEntry | null;
}

const YAML_PATH = path.resolve(__dirname, "..", "..", "scripts", "seed-data.yaml");

export interface SeededInquiry {
  id: string;
  customer_name: string;
  customer_email: string;
  status: SeedEntry["status"];
  topic: string | null;
  quality_alert: boolean;
}

/**
 * 既知シードデータの要約（テストのアサーションで参照）。
 * seed-data.yaml と一致させること。
 */
export const FIXTURES = {
  total: 5,
  byStatus: { processing: 0, draft: 3, sent: 2, error: 0 },
  byTopic: { development: 2, product: 1, other: 1, spam: 1 },
  qualityAlert: 1,
  emails: {
    sentDevelopment: "suzuki@example.net",
    sentOther: "tanaka@example.co.jp",
    draftProduct: "sato@example.com",
    draftSpam: "tamura@morita-marketing.example.com",
    draftNg: "takahashi@example.co.jp",
  },
} as const;

export function seedDatabase(dbPath: string): SeededInquiry[] {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      company_name TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      topic TEXT,
      original_topic TEXT,
      operator_edited_topic INTEGER,
      ai_response TEXT,
      final_response TEXT,
      classification_confidence REAL,
      quality_alert INTEGER NOT NULL DEFAULT 0,
      edit_distance REAL,
      run_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
    CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
  `);

  db.exec("DELETE FROM inquiries");

  const now = Date.now();
  const ts = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const tsOrNull = (m: number | null | undefined) => (m == null ? null : ts(m));

  const entries = yaml.load(fs.readFileSync(YAML_PATH, "utf8")) as SeedEntry[];

  const insert = db.prepare(`
    INSERT INTO inquiries (
      id, customer_name, customer_email, company_name,
      content, status, topic, original_topic,
      operator_edited_topic, ai_response, final_response,
      classification_confidence, quality_alert, edit_distance,
      created_at, updated_at, sent_at
    ) VALUES (
      @id, @customer_name, @customer_email, @company_name,
      @content, @status, @topic, @original_topic,
      @operator_edited_topic, @ai_response, @final_response,
      @classification_confidence, @quality_alert, @edit_distance,
      @created_at, @updated_at, @sent_at
    )
  `);

  const seeded: SeededInquiry[] = [];

  const insertAll = db.transaction((items: SeedEntry[]) => {
    for (const entry of items) {
      const id = randomUUID();
      insert.run({
        id,
        customer_name: entry.customer_name,
        customer_email: entry.customer_email,
        company_name: entry.company_name,
        content: entry.content,
        status: entry.status,
        topic: entry.topic,
        original_topic: entry.original_topic,
        operator_edited_topic: entry.operator_edited_topic ? 1 : 0,
        ai_response: entry.ai_response ? JSON.stringify(entry.ai_response) : null,
        final_response: entry.final_response ? JSON.stringify(entry.final_response) : null,
        classification_confidence: entry.classification_confidence,
        quality_alert: entry.quality_alert ? 1 : 0,
        edit_distance: entry.edit_distance,
        created_at: ts(entry.minutes_ago),
        updated_at: ts(entry.updated_minutes_ago),
        sent_at: tsOrNull(entry.sent_minutes_ago),
      });
      seeded.push({
        id,
        customer_name: entry.customer_name,
        customer_email: entry.customer_email,
        status: entry.status,
        topic: entry.topic,
        quality_alert: entry.quality_alert,
      });
    }
  });

  insertAll(entries);
  db.close();
  return seeded;
}

/** Playwright 設定と同じ E2E 用DBパスを解決する。 */
export function e2eDbPath(): string {
  return path.resolve(__dirname, "..", "..", "data", "e2e.db");
}
