import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ProcessTick:
    """One unit of work. Replace the body with real processing (idempotent, time-bounded)."""

    processed: int = field(default=0)

    async def execute(self) -> None:
        self.processed += 1
        logger.info("tick processed", extra={"count": self.processed})
