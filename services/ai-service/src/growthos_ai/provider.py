from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel

OutputT = TypeVar("OutputT", bound=BaseModel)


@dataclass(frozen=True)
class ProviderRunMetadata:
    provider: str
    model: str
    prompt_version: str
    input_hash: str
    schema_version: str


class AIProvider(Protocol):
    """Internal provider boundary. Implementations must return schema-validated output."""

    async def generate_structured(
        self, output_schema: type[OutputT]
    ) -> tuple[OutputT, ProviderRunMetadata]: ...


# OpenAI is the accepted first implementation. It is intentionally not constructed in Phase 1:
# no provider call, recommendation response, or credential requirement belongs in this shell.
