/** APIのエラーメッセージを画面に表示する。非JSONの障害応答にも対応する。 */
export async function requireOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const data = await response.json().catch(() => null);
  throw new Error(typeof data?.error === "string" ? data.error : fallback);
}
