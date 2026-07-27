# E2E テスト（Playwright）

公開フォーム → AI 下書き生成 → 管理画面でのレビュー・編集・送信という問い合わせ
ライフサイクル全体を、ブラウザ UI と API の両面から検証します。

## 構成

```
e2e/
├── api/                  # Playwright request fixture による API 直接テスト
│   ├── inquiries.api.spec.ts
│   ├── admin-inquiries.api.spec.ts
│   ├── mutations.api.spec.ts
│   └── health.api.spec.ts
├── ui/                   # chromium によるブラウザ UI テスト
│   ├── contact-form.spec.ts
│   ├── health-modal.spec.ts
│   ├── admin-list.spec.ts
│   ├── admin-detail-draft.spec.ts
│   ├── admin-send.spec.ts
│   ├── admin-topic.spec.ts
│   ├── lifecycle.spec.ts   # @mock タグ（マーカー駆動）
│   └── header-nav.spec.ts
└── support/
    ├── mock-llm.ts        # モック LLM サーバ（content マーカーで応答を出し分け）
    ├── seed.ts            # 任意DBへの再シード関数 + FIXTURES 定数
    ├── markers.ts         # [E2E:SPAM] / [E2E:NG] / [E2E:ERROR]
    ├── helpers.ts         # 作成/待機/フィルタ操作などの共通ヘルパー
    └── global-setup.ts    # E2E用DBの初期シード
```

## アーキテクチャ

- Next の `after()` がサーバ側で叩く LLM バックエンド(`LLM_API_URL`)を、ローカルの
  **モック LLM サーバ(:8787)** に向ける。応答は問い合わせ本文中のマーカーで決定的に分岐:
  - `[E2E:SPAM]` → topic=spam / 下書きなし
  - `[E2E:NG]`   → politeness=NG（品質要注意）
  - `[E2E:ERROR]`→ HTTP 500（→ error 状態）
  - 既定         → development の正常下書き（politeness OK）
- Next は専用DB `data/e2e.db`（`INQUIRIES_DB_PATH`）を使用し、開発DBを汚さない。
- SQLite 単一ファイル/単一サーバのため `workers: 1`（直列実行）。

## 実行

```bash
cd web

# 既定（モック）でフル実行
npm run test:e2e

# UI モード / ヘッドあり / レポート表示
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:report
```

`webServer` 設定により、Next 開発サーバとモック LLM サーバは自動起動する
（`reuseExistingServer` のため既存の :3000 があれば再利用）。

## 実 FastAPI バックエンドでの実行（任意）

```bash
# 別ターミナルで実バックエンドを起動
cd llm-app && uv run fastapi dev

# モックを使わず実 API で実行（マーカー依存の @mock テストは自動除外）
cd web && E2E_REAL_LLM=1 npm run test:e2e
```

実 API は非決定的・低速（最大 60s）で `ANTHROPIC_API_KEY` が必要。
マーカー駆動のテスト（spam/NG/error やライフサイクル分岐）は `@mock` タグで除外される。

## データ戦略

- read 系/フィルタ/ページングテストは `beforeEach`/`beforeAll` で `seed-data.yaml` の
  既知5件へ再シードしてから検証する（`FIXTURES` 定数と一致）。
- 変更系/ライフサイクルテストは一意の名前で自前の問い合わせを作成して操作するため、
  共有シードに依存せず順序非依存。
