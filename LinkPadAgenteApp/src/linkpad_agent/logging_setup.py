from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from linkpad_agent.config import LoggingConfig


def configure_logging(config: LoggingConfig, log_dir: Path) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("linkpad_agent")
    logger.setLevel(getattr(logging, config.level.upper(), logging.INFO))
    logger.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s", "%Y-%m-%dT%H:%M:%S%z"
    )
    file_handler = RotatingFileHandler(
        log_dir / "agent.log",
        maxBytes=config.max_file_mb * 1024 * 1024,
        backupCount=max(1, config.retention_days),
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    return logger
