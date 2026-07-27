import os
from typing import Any

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

load_dotenv()

ANTHROPIC_MODEL: str = os.environ.get("ANTHROPIC_MODEL") or "claude-sonnet-5"

# claude-sonnet-5では拡張思考のbudget_tokens指定が廃止され、adaptiveのみ指定できる。
# thinkingを未指定にするとデフォルトでadaptiveになるため、無効化は明示する必要がある
_THINKING_CONFIG: dict[str, Any] = {"type": "adaptive"}
_THINKING_DISABLED_CONFIG: dict[str, Any] = {"type": "disabled"}
_THINKING_MAX_TOKENS = 16000


def get_model(*, thinking: bool = False) -> BaseChatModel:
    """Create a chat model instance, optionally with extended thinking enabled."""
    kwargs: dict[str, Any] = {
        "model": ANTHROPIC_MODEL,
        "model_provider": "anthropic",
    }
    if thinking:
        kwargs["thinking"] = _THINKING_CONFIG
        kwargs["max_tokens"] = _THINKING_MAX_TOKENS
    else:
        kwargs["thinking"] = _THINKING_DISABLED_CONFIG
    return init_chat_model(**kwargs)  # type: ignore[no-any-return]
