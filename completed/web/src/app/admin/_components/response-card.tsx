import type { Inquiry } from "@/lib/db";
import { statusLabels, statusColors, formatDate } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ResponseCardProps {
  inquiry: Inquiry;
  editSubject: string;
  setEditSubject: (value: string) => void;
  editBody: string;
  setEditBody: (value: string) => void;
  isSaving: boolean;
  isSending: boolean;
  isBusy: boolean;
  onSaveDraft: () => void;
  onSend: () => void;
}

export function ResponseCard({
  inquiry,
  editSubject,
  setEditSubject,
  editBody,
  setEditBody,
  isSaving,
  isSending,
  isBusy,
  onSaveDraft,
  onSend,
}: ResponseCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          返信送信
          <Badge className={statusColors[inquiry.status]}>
            {statusLabels[inquiry.status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {inquiry.status === "draft" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">件名</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-body">本文</Label>
              <Textarea
                id="edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onSaveDraft}
                disabled={isBusy}
              >
                {isSaving ? "保存中..." : "下書き保存"}
              </Button>
              <Button onClick={onSend} disabled={isBusy}>
                {isSending ? "送信中..." : "送信"}
              </Button>
            </div>
          </>
        )}

        {inquiry.status === "sent" && inquiry.final_response && (
          <>
            {inquiry.sent_at && (
              <div className="text-sm text-gray-500">
                {formatDate(inquiry.sent_at)} 送信
              </div>
            )}
            <div>
              <span className="text-gray-500 text-sm">件名:</span>
              <p className="font-medium">
                {inquiry.final_response.subject}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">本文:</span>
              <p className="whitespace-pre-wrap mt-1 bg-gray-50 p-4 rounded">
                {inquiry.final_response.body}
              </p>
            </div>
            {inquiry.edit_distance != null && (
              <div className="text-sm text-gray-500">
                編集距離スコア: {inquiry.edit_distance.toFixed(2)}（1.0 = 編集なし）
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
