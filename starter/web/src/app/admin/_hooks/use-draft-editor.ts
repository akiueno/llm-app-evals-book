"use client";

import { useState, useEffect, useRef } from "react";
import type { Inquiry } from "@/lib/db";
import { requireOk } from "@/lib/client-api";

interface UseDraftEditorParams {
  selectedInquiry: Inquiry | null;
  fetchInquiries: () => Promise<void>;
  fetchInquiryDetail: (id: string) => Promise<void>;
}

export function useDraftEditor({
  selectedInquiry, fetchInquiries, fetchInquiryDetail,
}: UseDraftEditorParams) {
  const [editSubject, updateSubject] = useState("");
  const [editBody, updateBody] = useState("");
  const editorId = useRef<string | null>(null);
  const dirty = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    id: string; type: "success" | "error"; text: string;
  } | null>(null);
  const id = selectedInquiry?.id ?? null;
  const response = selectedInquiry?.final_response ?? selectedInquiry?.generated_draft;
  const subject = response?.subject ?? "";
  const body = response?.body ?? "";

  useEffect(() => {
    if (editorId.current !== id) {
      editorId.current = id;
      dirty.current = false;
      setMessage(null);
    }
    // 分類変更・定期取得では未保存の入力を上書きしない。
    if (!dirty.current) {
      updateSubject(subject);
      updateBody(body);
    }
  }, [id, subject, body]);

  const setEditSubject = (value: string) => { dirty.current = true; updateSubject(value); };
  const setEditBody = (value: string) => { dirty.current = true; updateBody(value); };

  async function mutate(endpoint: string, data: object, success: string) {
    if (!id || pending) return;
    const inquiryId = id;
    setPending(endpoint);
    setMessage(null);
    try {
      const result = await fetch(`/api/admin/inquiries/${inquiryId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await requireOk(result, "操作に失敗しました。もう一度お試しください。");
      await Promise.all([fetchInquiries(), fetchInquiryDetail(inquiryId)]);
      setMessage({ id: inquiryId, type: "success", text: success });
    } catch (err) {
      setMessage({ id: inquiryId, type: "error", text: err instanceof Error ? err.message : "操作に失敗しました" });
    } finally {
      setPending(null);
    }
  }

  const handleSaveDraft = () => mutate("draft", { subject: editSubject, body: editBody }, "下書きを保存しました");
  const handleSend = () => {
    if (confirm("この内容でメールを送信します。よろしいですか？\n\n※実際のメール送信は行われません")) {
      void mutate("send", { subject: editSubject, body: editBody }, "送信しました");
    }
  };
  const handleTopicChange = (topic: string) => mutate("topic", { topic }, "分類を変更しました");
  const handleClose = () => {
    if (confirm("このお問い合わせを対応不要として終了します。よろしいですか？")) {
      void mutate("close", {}, "対応不要として終了しました");
    }
  };

  return {
    editSubject, setEditSubject, editBody, setEditBody,
    isSaving: pending === "draft", isSending: pending === "send",
    isUpdatingTopic: pending !== null, isClosing: pending === "close", isBusy: pending !== null,
    saveMessage: message?.id === id ? message : null,
    handleSaveDraft, handleSend, handleTopicChange, handleClose,
  };
}
