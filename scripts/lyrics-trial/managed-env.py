#!/usr/bin/env python3
"""Run lyric tools in an automatically owned, disposable Python environment."""
import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
TTL = 30 * 86400
KIND = "alchemy-managed-lyrics-v1"


def managed_paths(root, create=True):
    cache = root / ".cache"
    if cache.is_symlink():
        raise RuntimeError("Linked cache is not managed")
    if not create and not cache.exists():
        return None, None
    cache.mkdir(exist_ok=True)
    if not cache.is_dir():
        raise RuntimeError("Cache is not a directory")
    return cache / "alchemy-lyrics-venv", cache / "alchemy-lyrics.lock"


def read_marker(env):
    marker = env / ".alchemy-managed.json"
    if env.is_symlink() or not env.is_dir() or marker.is_symlink() or not marker.is_file():
        return None
    try:
        value = json.loads(marker.read_text())
        return value if value.get("kind") == KIND else None
    except (OSError, ValueError, AttributeError):
        return None


def open_lock(lock):
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(lock, flags, 0o600)
    os.set_inheritable(fd, True)
    return fd


def prune(root, now=None, dry_run=False):
    env, lock = managed_paths(root, create=False)
    if env is None:
        return False
    if dry_run and not lock.exists():
        return False
    fd = open_lock(lock)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        marker = read_marker(env)
        if not marker or not isinstance(marker.get("last_used"), (int, float)) or not math.isfinite(marker["last_used"]):
            return False
        if (time.time() if now is None else now) - marker["last_used"] < TTL:
            return False
        if not dry_run:
            shutil.rmtree(env)
        return True
    finally:
        os.close(fd)


def run(root, script, args):
    tools = root / "scripts" / "lyrics-trial"
    source = tools / script
    if script not in {"align.py", "assess.py", "phrase-align.py", "recover.py", "separate.py", "transcribe-check.py"}:
        raise ValueError("Unknown lyrics tool")
    env, lock = managed_paths(root)
    fd = open_lock(lock)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        requirements = tools / "requirements.txt"
        digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
        marker = read_marker(env)
        if (env.exists() or env.is_symlink()) and marker is None:
            raise RuntimeError("Unrecognized lyrics environment preserved")
        if not marker or marker.get("requirements") != digest:
            if marker:
                shutil.rmtree(env)
            try:
                subprocess.run(["python3.11", "-m", "venv", str(env)], check=True, pass_fds=(fd,))
                subprocess.run([str(env / "bin/python"), "-m", "pip", "install", "-r", str(requirements)], check=True, pass_fds=(fd,))
                (env / ".alchemy-managed.json").write_text(json.dumps({"kind": KIND, "requirements": digest, "last_used": time.time()}))
            except BaseException:
                if env.exists() and not env.is_symlink():
                    shutil.rmtree(env)
                raise
        try:
            result = subprocess.run([str(env / "bin/python"), str(source), *args], cwd=root, pass_fds=(fd,))
            return result.returncode
        finally:
            marker = read_marker(env)
            if marker:
                marker["last_used"] = time.time()
                (env / ".alchemy-managed.json").write_text(json.dumps(marker))
    finally:
        os.close(fd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prune", action="store_true")
    parser.add_argument("--hold-lock", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("script", nargs="?")
    parser.add_argument("args", nargs=argparse.REMAINDER)
    parsed = parser.parse_args()
    if parsed.hold_lock:
        _, lock = managed_paths(parsed.root)
        fd = open_lock(lock)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print(json.dumps({"held": False}), flush=True)
                return 1
            print(json.dumps({"held": True}), flush=True)
            sys.stdin.buffer.read()
            return 0
        finally:
            os.close(fd)
    if parsed.prune:
        print(json.dumps({"removed": prune(parsed.root, dry_run=parsed.dry_run)}))
        return 0
    if not parsed.script:
        parser.error("a lyrics tool is required")
    return run(parsed.root, parsed.script, parsed.args)


if __name__ == "__main__":
    sys.exit(main())
