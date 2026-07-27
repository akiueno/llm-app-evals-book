# お問い合わせ対応AIアシスタント

書籍「LLMアプリケーション評価駆動開発」第2部ハンズオンのサンプルアプリケーションです。お問い合わせフォームから送信された問い合わせに対してAIが返信案を生成し、担当者が管理画面で確認・編集して送信します。

詳しい解説やセットアップ手順は書籍本編を参照してください。

## 構成

| ディレクトリ | 内容 |
| --- | --- |
| `web/` | お問い合わせフォームと管理画面（Next.js） |
| `llm-app/` | 返信案を生成するAIワークフロー（FastAPI + LangGraph） |
| `docs/spec.md` | アプリケーションの仕様書 |

開発環境にはDev Container（`.devcontainer/`）を使用します。

## 起動方法

### llm-app（FastAPI）

```bash
cd llm-app
cp .env.example .env  # APIキーなどを設定
uv sync
uv run fastapi dev
```

### web（Next.js）

```bash
cd web
npm ci
npm run seed  # サンプルデータの投入
npm run dev
```

<http://localhost:3000> でお問い合わせフォーム、<http://localhost:3000/admin> で管理画面が開きます。
