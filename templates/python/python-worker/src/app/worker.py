import asyncio
import contextlib

from app.application.process_tick import ProcessTick


async def run_worker(
    process_tick: ProcessTick,
    interval_seconds: float,
    stop: asyncio.Event,
) -> None:
    """Run a tick every `interval_seconds` until `stop` is set."""
    while not stop.is_set():
        await process_tick.execute()
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
