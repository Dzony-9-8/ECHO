"""
ECHO V4 — Structured Logging (backend/app/core/logging.py)
Rotating file handler. In portable mode, logs to ECHO_STORAGE_ROOT/logs/.
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from .config import ECHO_MODE, ECHO_STORAGE_ROOT

def get_log_dir() -> str:
    if ECHO_MODE == "portable":
        log_dir = os.path.join(ECHO_STORAGE_ROOT, "logs")
    else:
        log_dir = os.path.join(".", "logs")
    os.makedirs(log_dir, exist_ok=True)
    return log_dir

def setup_logging(name: str = "echo") -> logging.Logger:
    log_dir  = get_log_dir()
    log_file = os.path.join(log_dir, f"{name}.log")

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Avoid duplicate handlers on reload
    if logger.handlers:
        return logger

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Rotating file — max 5 MB × 3 backups
    fh = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    # Console output (suppress in portable mode to avoid host leakage)
    if ECHO_MODE != "portable":
        ch = logging.StreamHandler()
        ch.setFormatter(fmt)
        logger.addHandler(ch)

    return logger

logger = setup_logging("echo")
