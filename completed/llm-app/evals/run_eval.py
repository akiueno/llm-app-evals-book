"""LangSmith 評価実行スクリプト.

データセット名は環境変数 LANGSMITH_DATASET で指定する。

Usage:
    uv run python -m evals.run_eval
"""

import asyncio
import os
from typing import Any

from dotenv import load_dotenv
from langsmith.evaluation import aevaluate

from app.generate.graph import graph
from evals.evaluators.classification_accuracy import classification_accuracy
from evals.evaluators.forbidden_content_judge import forbidden_content_judge
from evals.evaluators.politeness_judge import politeness_judge

load_dotenv()


async def target(inputs: dict[str, Any]) -> dict[str, Any]:
    """LangGraph ワークフローを実行するターゲット関数."""
    result: dict[str, Any] = await graph.ainvoke(
        {
            "content": inputs["content"],
            "customer_name": inputs["customer_name"],
            "company_name": inputs.get("company_name"),
        }
    )
    return result


async def main() -> None:
    dataset_name = os.environ["LANGSMITH_DATASET"]
    print(f"データセット: {dataset_name}")
    print("評価を開始します...")

    results = await aevaluate(
        target,
        data=dataset_name,
        evaluators=[
            classification_accuracy,
            politeness_judge,
            forbidden_content_judge,
        ],
    )

    print(f"評価完了: {results.experiment_name}")


if __name__ == "__main__":
    asyncio.run(main())
