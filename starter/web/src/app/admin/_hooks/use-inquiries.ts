"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Inquiry, InquiryListItem } from "@/lib/db";
import { requireOk } from "@/lib/client-api";

export function useInquiries() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const selectedId = useRef<string | null>(null);
  const detailRequest = useRef(0);
  const listRequest = useRef(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchInquiries = useCallback(async () => {
    const request = ++listRequest.current;
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (topicFilter !== "all") params.set("topic", topicFilter);
      const response = await fetch(`/api/admin/inquiries?${params}`);
      await requireOk(response, "お問い合わせ一覧の取得に失敗しました");
      const data = await response.json();
      if (request !== listRequest.current) return;
      setInquiries(data.items);
      setListError(null);
    } catch (err) {
      if (request === listRequest.current) {
        setListError(err instanceof Error ? err.message : "一覧の取得に失敗しました");
      }
    } finally {
      if (request === listRequest.current) setIsLoading(false);
    }
  }, [statusFilter, topicFilter]);

  // 操作完了後やポーリングで取得しても、別の問い合わせへ選択を戻さない。
  const fetchInquiryDetail = useCallback(async (id: string) => {
    if (selectedId.current !== id) return;
    const request = ++detailRequest.current;
    try {
      const response = await fetch(`/api/admin/inquiries/${id}`);
      await requireOk(response, "お問い合わせ詳細の取得に失敗しました");
      const data: Inquiry = await response.json();
      if (selectedId.current !== id || request !== detailRequest.current) return;
      setSelectedInquiry(data);
      setDetailError(null);
    } catch (err) {
      if (selectedId.current === id && request === detailRequest.current) {
        setDetailError(err instanceof Error ? err.message : "詳細の取得に失敗しました");
      }
    }
  }, []);

  const selectInquiry = useCallback((id: string) => {
    if (selectedId.current !== id) {
      selectedId.current = id;
      setSelectedInquiry(null);
      setDetailError(null);
      setRetryError(null);
    }
    void fetchInquiryDetail(id);
  }, [fetchInquiryDetail]);

  const retryGeneration = useCallback(async (id: string) => {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/admin/inquiries/${id}/retry`, { method: "POST" });
      await requireOk(response, "返信案の再生成に失敗しました");
      await Promise.all([fetchInquiryDetail(id), fetchInquiries()]);
    } catch (err) {
      if (selectedId.current === id) {
        setRetryError(err instanceof Error ? err.message : "再生成に失敗しました");
      }
    } finally {
      setIsRetrying(false);
    }
  }, [fetchInquiryDetail, fetchInquiries]);

  useEffect(() => {
    void fetchInquiries();
    const interval = setInterval(() => {
      void fetchInquiries();
      if (selectedId.current) void fetchInquiryDetail(selectedId.current);
    }, 5000);
    return () => {
      clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 最新のリクエスト番号を無効化するため現在値を使う
      ++listRequest.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 最新のリクエスト番号を無効化するため現在値を使う
      ++detailRequest.current;
    };
  }, [fetchInquiries, fetchInquiryDetail]);

  return {
    inquiries, selectedInquiry, selectInquiry,
    statusFilter, setStatusFilter, topicFilter, setTopicFilter,
    isLoading, errors: [listError, detailError, retryError].filter(Boolean),
    fetchInquiries, fetchInquiryDetail, retryGeneration, isRetrying,
  };
}
