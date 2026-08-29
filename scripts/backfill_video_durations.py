"""Backfill master_sessions.video_duration_minutes by parsing MP4 mvhd atoms via range requests."""
import os
import struct
import sys
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def parse_mvhd(data: bytes):
    idx = data.find(b"mvhd")
    if idx == -1:
        return None
    p = idx + 4
    version = data[p]
    p += 4
    try:
        if version == 1:
            timescale = struct.unpack(">I", data[p + 16:p + 20])[0]
            duration = struct.unpack(">Q", data[p + 20:p + 28])[0]
        else:
            timescale = struct.unpack(">I", data[p + 8:p + 12])[0]
            duration = struct.unpack(">I", data[p + 12:p + 16])[0]
        if timescale > 0 and duration > 0:
            return duration / timescale
    except struct.error:
        return None
    return None


def get_duration_seconds(url: str):
    r = requests.get(url, headers={"Range": "bytes=0-131071"}, timeout=30)
    secs = parse_mvhd(r.content)
    if secs:
        return secs
    head = requests.head(url, timeout=15)
    size = int(head.headers.get("content-length") or 0)
    if size > 131072:
        start = max(0, size - 4 * 1024 * 1024)
        r = requests.get(url, headers={"Range": f"bytes={start}-{size - 1}"}, timeout=60)
        return parse_mvhd(r.content)
    return None


def main():
    rows = requests.get(
        f"{URL}/rest/v1/master_sessions"
        "?select=id,title,lecture_url&lecture_url=not.is.null"
        "&video_duration_minutes=is.null&limit=200",
        headers=H, timeout=30,
    ).json()
    print(f"Sessions to backfill: {len(rows)}", flush=True)
    ok, fail = 0, 0
    for s in rows:
        try:
            secs = get_duration_seconds(s["lecture_url"])
            if not secs or secs <= 0:
                print(f"FAIL (no mvhd) {s['title'][:50]} {s['lecture_url'][-30:]}", flush=True)
                fail += 1
                continue
            mins = round(secs / 60, 2)
            pr = requests.patch(
                f"{URL}/rest/v1/master_sessions?id=eq.{s['id']}",
                headers=H, json={"video_duration_minutes": mins}, timeout=15,
            )
            if pr.status_code < 300:
                ok += 1
                print(f"OK {mins:>7.2f} min  {s['title'][:60]}", flush=True)
            else:
                fail += 1
                print(f"FAIL patch {pr.status_code} {s['title'][:50]}", flush=True)
        except Exception as e:
            fail += 1
            print(f"FAIL {s['title'][:50]}: {e}", flush=True)
    print(f"DONE ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
