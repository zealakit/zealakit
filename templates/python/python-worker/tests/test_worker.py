import asyncio

from app.application.process_tick import ProcessTick
from app.worker import run_worker


def test_worker_ticks_until_stopped() -> None:
    async def scenario() -> int:
        tick = ProcessTick()
        stop = asyncio.Event()
        task = asyncio.create_task(run_worker(tick, 0.01, stop))
        await asyncio.sleep(0.08)
        stop.set()
        await asyncio.wait_for(task, timeout=1)
        return tick.processed

    assert asyncio.run(scenario()) >= 2


def test_worker_stops_immediately_when_already_stopped() -> None:
    async def scenario() -> int:
        tick = ProcessTick()
        stop = asyncio.Event()
        stop.set()
        await run_worker(tick, 60, stop)
        return tick.processed

    assert asyncio.run(scenario()) == 0
