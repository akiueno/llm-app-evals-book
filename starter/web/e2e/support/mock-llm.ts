/**
 * モックLLMサーバ。
 *
 * Next.js の after() ジョブが叩く LLM バックエンド(LLM_API_URL)を置き換え、
 * 問い合わせ本文(content)中のマーカー文字列に応じて決定的な応答を返す。
 *
 * エンドポイント:
 *   GET  /api/health   -> 200 { status: "ok" }
 *   POST /api/generate -> マーカーに応じた GenerateResponse 互換の JSON
 *   POST /api/feedback -> 200 固定スコア（第10章の送信ルートが利用）
 *
 * 起動: npx tsx e2e/support/mock-llm.ts  (PORT は MOCK_LLM_PORT, 既定 8787)
 */
import { createServer } from "http";
import { MARKERS } from "./markers";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 8787);

interface GenerateRequest {
  customer_name?: string;
  company_name?: string;
  content?: string;
}

function okDraft(topic: string) {
  return {
    topic,
    classification_confidence: 0.91,
    generated_draft: {
      subject: "Re: お問い合わせありがとうございます",
      body: [
        "お問い合わせいただきありがとうございます。",
        "株式会社サンプルエージェントの担当でございます。",
        "",
        "内容を確認のうえ、担当者より改めてご連絡いたします。",
        "何卒よろしくお願いいたします。",
      ].join("\n"),
      quality_scores: { politeness: "OK", politeness_reason: "" },
    },
    run_id: "mock-run-ok",
  };
}

function ngDraft() {
  return {
    topic: "development",
    classification_confidence: 0.85,
    generated_draft: {
      subject: "Re: お問い合わせの件",
      body: [
        "お問い合わせありがとうございます。",
        "全然対応可能かと思います。詳細は後で詰めちゃいましょう。",
        "日程いくつかもらえますか。",
      ].join("\n"),
      quality_scores: {
        politeness: "NG",
        politeness_reason:
          "「全然対応可能かと」「詰めちゃいましょう」「もらえますか」など敬体が不十分な表現が含まれています",
      },
    },
    run_id: "mock-run-ng",
  };
}

function spamResponse() {
  return {
    topic: "spam",
    classification_confidence: 0.98,
    generated_draft: null,
    run_id: "mock-run-spam",
  };
}

function send(res: import("http").ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = req.url ?? "";

  if (req.method === "GET" && url.startsWith("/api/health")) {
    send(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && url.startsWith("/api/generate")) {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body: GenerateRequest = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        // 無効なJSONは既定応答にフォールバック
      }
      const content = body.content ?? "";

      if (content.includes(MARKERS.ERROR)) {
        send(res, 500, { detail: "mock LLM forced error" });
        return;
      }
      if (content.includes(MARKERS.SPAM)) {
        send(res, 200, spamResponse());
        return;
      }
      if (content.includes(MARKERS.NG)) {
        send(res, 200, ngDraft());
        return;
      }
      send(res, 200, okDraft("development"));
    });
    return;
  }

  if (req.method === "POST" && url.startsWith("/api/feedback")) {
    send(res, 200, {
      operator_edited_topic: false,
      edit_distance: 0.93,
    });
    return;
  }

  send(res, 404, { detail: "not found" });
});

server.listen(PORT, () => {
  // Playwright の webServer はこの出力で待機解除はしないが、ログとして有用
  console.log(`[mock-llm] listening on http://localhost:${PORT}`);
});
