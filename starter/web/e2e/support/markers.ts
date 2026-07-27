/**
 * モックLLMサーバの応答を駆動するマーカー文字列。
 * 問い合わせ本文(content)に含めることで、AI生成結果を決定的に切り替える。
 * これらは実LLMでは意味を持たないため、利用するテストには @mock タグを付ける。
 */
export const MARKERS = {
  /** topic=spam / generated_draft=null を返す */
  SPAM: "[E2E:SPAM]",
  /** politeness=NG の下書きを返す（quality_alert=true になる） */
  NG: "[E2E:NG]",
  /** HTTP 500 を返す（→ inquiry が error 状態になる） */
  ERROR: "[E2E:ERROR]",
} as const;
