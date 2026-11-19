import asyncio
import logging
import signal

from app.bootstrap.config import get_settings
from app.bootstrap.container import build_container
from app.worker import run_worker


async def main() -> None:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    container = build_container()

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    await run_worker(container.process_tick, settings.tick_interval_seconds, stop)


if __name__ == "__main__":
    asyncio.run(main())
