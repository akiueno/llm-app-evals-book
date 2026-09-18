/**
 * モックLLMサーバ。
 *
 * Next.js の after() ジョブが叩く LLM バックエンド(LLM_API_URL)を置き換え、
 * 問い合わせ本文(content)中のマーカー文字列に応じて決定的な応答を返す。
 *
 * エンドポイント:
 *   GET  /api/health   -> 200 { status: "ok" }
 *   POST /api/generate -> マーカーに応じた GenerateResponse 互換の JSON
 *   POST /api/feedback -> 200 決定的スコア（第10章の送信ルートが利用。ai_body=null なら edit_distance=null）
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

let feedbackCount = 0;

const server = createServer((req, res) => {
  const url = req.url ?? "";

  if (req.method === "GET" && url.startsWith("/api/health")) {
    send(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && url === "/test/feedback-count") {
    send(res, 200, { count: feedbackCount });
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
    feedbackCount += 1;
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body: {
        ai_body?: string | null;
        final_body?: string;
        original_topic?: string;
        current_topic?: string;
      } = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        // 無効なJSONは既定応答にフォールバック
      }
      // 紙面308ページのFeedbackRequestと同じく、最終返信は文字列が必須。
      if (typeof body.final_body !== "string") {
        send(res, 422, { detail: "final_body must be a string" });
        return;
      }
      send(res, 200, {
        operator_edited_topic: body.original_topic !== body.current_topic,
        // ai_body が null（返信案なし）のとき edit_distance は未定義
        edit_distance: body.ai_body == null ? null : 0.93,
      });
    });
    return;
  }

  send(res, 404, { detail: "not found" });
});

server.listen(PORT, () => {
  // Playwright の webServer はこの出力で待機解除はしないが、ログとして有用
  console.log(`[mock-llm] listening on http://localhost:${PORT}`);
});
