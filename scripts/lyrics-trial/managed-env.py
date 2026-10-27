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
KINDS = {
    "lyrics": "alchemy-managed-lyrics-v1",
    "fonts": "alchemy-managed-fonts-v1",
}


def managed_paths(root, create=True, environment="lyrics"):
    cache = root / ".cache"
    if cache.is_symlink():
        raise RuntimeError("Linked cache is not managed")
    if not create and not cache.exists():
        return None, None
    cache.mkdir(exist_ok=True)
    if not cache.is_dir():
        raise RuntimeError("Cache is not a directory")
    if environment not in KINDS:
        raise ValueError("Unknown managed environment")
    return cache / f"alchemy-{environment}-venv", cache / f"alchemy-{environment}.lock"


def read_marker(env, environment="lyrics"):
    marker = env / ".alchemy-managed.json"
    if env.is_symlink() or not env.is_dir() or marker.is_symlink() or not marker.is_file():
        return None
    try:
        value = json.loads(marker.read_text())
        return value if value.get("kind") == KINDS[environment] else None
    except (OSError, ValueError, AttributeError):
        return None


def open_lock(lock):
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(lock, flags, 0o600)
    os.set_inheritable(fd, True)
    return fd


def prune(root, now=None, dry_run=False, environment="lyrics"):
    env, lock = managed_paths(root, create=False, environment=environment)
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
        marker = read_marker(env, environment)
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
                (env / ".alchemy-managed.json").write_text(json.dumps({"kind": KINDS["lyrics"], "requirements": digest, "last_used": time.time()}))
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


def run_fonts(root, version, command):
    if not version or any(c not in "0123456789." for c in version) or not command:
        raise ValueError("A pinned fontTools version and command are required")
    env, lock = managed_paths(root, environment="fonts")
    fd = open_lock(lock)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        marker = read_marker(env, "fonts")
        if (env.exists() or env.is_symlink()) and marker is None:
            raise RuntimeError("Unrecognized font environment preserved")
        if not marker or marker.get("version") != version:
            if marker:
                shutil.rmtree(env)
            try:
                subprocess.run([sys.executable, "-m", "venv", str(env)], check=True, pass_fds=(fd,))
                subprocess.run([str(env / "bin/python"), "-m", "pip", "install", f"fonttools=={version}"], check=True, pass_fds=(fd,))
                (env / ".alchemy-managed.json").write_text(json.dumps({"kind": KINDS["fonts"], "version": version, "last_used": time.time()}))
            except BaseException:
                if env.exists() and not env.is_symlink():
                    shutil.rmtree(env)
                raise
        child_env = {**os.environ, "ALCHEMY_FONT_PYTHON": str(env / "bin/python"), "ALCHEMY_FONT_LOCK_FD": str(fd)}
        try:
            return subprocess.run(command, cwd=root, env=child_env, pass_fds=(fd,)).returncode
        finally:
            marker = read_marker(env, "fonts")
            if marker:
                marker["last_used"] = time.time()
                (env / ".alchemy-managed.json").write_text(json.dumps(marker))
    finally:
        os.close(fd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prune", action="store_true")
    parser.add_argument("--hold-lock", action="store_true")
    parser.add_argument("--environment", choices=tuple(KINDS), default="lyrics")
    parser.add_argument("--font-version")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("script", nargs="?")
    parser.add_argument("args", nargs=argparse.REMAINDER)
    parsed = parser.parse_args()
    if parsed.hold_lock:
        locks = []
        try:
            for environment in KINDS:
                _, lock = managed_paths(parsed.root, environment=environment)
                fd = open_lock(lock)
                locks.append(fd)
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    print(json.dumps({"held": False}), flush=True)
                    return 1
            print(json.dumps({"held": True}), flush=True)
            sys.stdin.buffer.read()
            return 0
        finally:
            for fd in locks:
                os.close(fd)
    if parsed.prune:
        print(json.dumps({"removed": prune(parsed.root, dry_run=parsed.dry_run, environment=parsed.environment)}))
        return 0
    if parsed.environment == "fonts":
        return run_fonts(parsed.root, parsed.font_version, [parsed.script, *parsed.args] if parsed.script else [])
    if not parsed.script:
        parser.error("a lyrics tool is required")
    return run(parsed.root, parsed.script, parsed.args)


if __name__ == "__main__":
    sys.exit(main())
