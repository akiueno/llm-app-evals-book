from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.generate.types import GraphState
from app.llm import get_model

_SYSTEM_PROMPT_TEMPLATE = """\
あなたは株式会社サンプルエージェントのカスタマーサポート担当です。
お客様からのお問い合わせに対して、丁寧なビジネスメール形式で返信を作成してください。

<rules>
- 敬語（尊敬語・謙譲語・丁寧語）を正しく使い分けること
- 宛名（会社名・お客様名）を含めること
- 挨拶文から始めること
- 具体的で役立つ返信を提供すること
- 締めの挨拶で終わること
- 返信件名はお問い合わせ内容に基づいた適切な件名にすること
</rules>

<forbidden>
以下は絶対に返信に含めないでください。含めた場合、その返信は不合格となります。

1. 見積り金額の提示
   費用・料金・単価を具体的な数値で書かないこと。
   「概算で300万円程度」「月額10万円」「500万〜800万円」のような記述は、
   目安・参考値・レンジであっても禁止です。
   代わりに「詳細をお伺いしたうえでお見積りをご提示いたします」と案内すること。

2. 未確定情報の断定
   確認が必要な事項を断定しないこと。
   「必ず対応可能です」「確実に実装できます」「十分対応可能です」「問題ございません」
   のような断言は禁止です。
   代わりに「担当より確認のうえご回答いたします」「ご要件を伺ったうえでご提案いたします」
   のように、確認を前提とした表現を用いること。
   開発期間・スケジュール・納期についても、確定した約束として書かないこと。

3. 競合他社への言及
   他社の製品名・サービス名・会社名に言及しないこと。
   「他社製品との比較資料」「競合サービスとの比較」といった間接的な言及も禁止です。
   自社サービスの説明のみで完結させること。
</forbidden>

<output_quality>
- response_body は、そのまま送信できる完成されたメール本文のみとすること。
- 出力する前に必ず読み返し、誤字・脱字・衍字（文中に紛れ込んだ無意味な1文字など）が
  ないことを確認すること。
- 見出し記号や箇条書きは使ってもよいが、行頭・文中に意味のない文字を混入させないこと。
- Markdown 記法（**、##、``` など）は使用しないこと。
</output_quality>"""

_USER_PROMPT_TEMPLATE = """\
以下のお問い合わせに対して返信メールを作成してください。件名と本文を分けて出力してください。

<inquiry>
<topic>{topic}</topic>
<customer_name>{customer_name}</customer_name>
<company_name>{company_name}</company_name>
<content>
{content}
</content>
</inquiry>"""


class GeneratedResponse(BaseModel):
    """生成された返信メール"""

    response_subject: str = Field(
        description="返信メールの件名（お問い合わせ内容から適切な件名を生成）"
    )
    response_body: str = Field(description="返信メールの本文")


async def generate_response(state: GraphState) -> GraphState:
    """問い合わせ内容に基づいて返信メールを生成する。"""
    model = get_model(thinking=True)
    model_with_structure = model.with_structured_output(GeneratedResponse, method="json_schema")

    user_content = _USER_PROMPT_TEMPLATE.format(
        topic=state.get("topic", "other"),
        customer_name=state["customer_name"],
        company_name=state.get("company_name") or "（なし）",
        content=state["content"],
    )
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT_TEMPLATE),
        HumanMessage(content=user_content),
    ]
    result: GeneratedResponse = await model_with_structure.ainvoke(messages)  # type: ignore[assignment]

    return {
        "response_subject": result.response_subject,
        "response_body": result.response_body,
    }
