"""Push local changes to the droplet and rebuild the stack.

Usage (from repo root):
    MAKAN_DEPLOY_HOST=67.205.148.199 MAKAN_DEPLOY_PASS=... \\
        python deploy/push.py

It tars the source (excluding node_modules/.next/.venv/data), uploads it,
and runs `docker compose up -d --build` on the server. Persistent data
(database, uploaded photos) lives in Docker volumes and is untouched.

Requires: paramiko  (pip install paramiko)
"""
import os
import subprocess
import sys
import tarfile
import tempfile
import time

try:
    import paramiko
except ImportError:
    sys.exit("pip install paramiko")

HOST = os.environ.get("MAKAN_DEPLOY_HOST", "67.205.148.199")
PASSWORD = os.environ.get("MAKAN_DEPLOY_PASS")
if not PASSWORD:
    sys.exit("set MAKAN_DEPLOY_PASS")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDE = {
    "node_modules", ".next", ".venv", ".git", "data",
    "__pycache__", ".pytest_cache", ".idea",
}


def _filter(info: tarfile.TarInfo):
    parts = set(info.name.split("/"))
    return None if parts & EXCLUDE else info


def make_tarball(path: str) -> None:
    with tarfile.open(path, "w:gz") as tar:
        for top in ("backend", "frontend", "deploy"):
            tar.add(os.path.join(ROOT, top), arcname=top, filter=_filter)


def sh(client, cmd, timeout=3600):
    _, out, _ = client.exec_command(cmd, timeout=timeout, get_pty=False)
    data = out.read().decode("utf-8", "replace")
    out.channel.recv_exit_status()
    return data


def main():
    tarball = os.path.join(tempfile.gettempdir(), "makan-push.tar.gz")
    print("packing...", flush=True)
    make_tarball(tarball)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)

    print("uploading...", flush=True)
    sftp = client.open_sftp()
    sftp.put(tarball, "/root/makan.tar.gz")
    sftp.close()

    print("extracting + building (detached)...", flush=True)
    sh(client, "rm -rf /root/makan && mkdir -p /root/makan && tar xzf /root/makan.tar.gz -C /root/makan")
    sh(
        client,
        "cd /root/makan/deploy && BUILDKIT_PROGRESS=plain nohup docker compose "
        "-f docker-compose.prod.yml up -d --build > /root/deploy.log 2>&1 & echo ok",
    )

    for _ in range(90):
        time.sleep(20)
        states = sh(
            client,
            "cd /root/makan/deploy && docker compose -f docker-compose.prod.yml "
            "ps --format '{{.Service}}:{{.State}}' 2>/dev/null",
        ).split()
        sm = dict(s.split(":", 1) for s in states if ":" in s)
        print(f"  {sm}", flush=True)
        if len(sm) >= 4 and all(v == "running" for v in sm.values()):
            print("ALL UP", flush=True)
            break

    client.close()


if __name__ == "__main__":
    main()
