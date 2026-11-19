from dataclasses import dataclass

from app.application.process_tick import ProcessTick


@dataclass(frozen=True)
class Container:
    """Composition root: the only place that knows concrete adapters."""

    process_tick: ProcessTick


def build_container() -> Container:
    return Container(process_tick=ProcessTick())
