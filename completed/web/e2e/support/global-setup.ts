/**
 * グローバルセットアップ: E2E用DBを既知のシードデータで初期化する。
 * Next サーバと同じ INQUIRIES_DB_PATH(=data/e2e.db) に対して DELETE + INSERT を行う。
 * （ファイル削除はせず行を入れ替えるため、サーバの起動順序に依存しない）
 */
import { seedDatabase, e2eDbPath } from "./seed";

async function globalSetup() {
  const dbPath = e2eDbPath();
  const seeded = seedDatabase(dbPath);
  console.log(`[global-setup] seeded ${seeded.length} inquiries into ${dbPath}`);
}

export default globalSetup;
