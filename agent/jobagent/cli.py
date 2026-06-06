"""Command-line entry point for the job application agent.

Usage:
  python -m jobagent.cli apply <url> [<url> ...]
  python -m jobagent.cli apply --file urls.txt
  python -m jobagent.cli draft <url>            # generate materials only (no browser)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import config
from .runner import process_url, rank
from .tracker import applied_urls


def _collect_urls(args) -> list[str]:
    urls: list[str] = list(args.urls or [])
    if args.file:
        path = Path(args.file)
        if not path.exists():
            raise SystemExit(f"URL file not found: {path}")
        urls += [ln.strip() for ln in path.read_text().splitlines()
                 if ln.strip() and not ln.startswith("#")]
    if not urls:
        raise SystemExit("No URLs provided. Pass URLs or --file urls.txt.")
    # de-duplicate, preserving order
    seen: set[str] = set()
    deduped = [u for u in urls if not (u in seen or seen.add(u))]
    return deduped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jobagent", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    for cmd in ("apply", "draft", "rank"):
        p = sub.add_parser(cmd, help=f"{cmd} job posting URL(s)")
        p.add_argument("urls", nargs="*", help="Job posting URL(s)")
        p.add_argument("--file", help="Text file with one URL per line")
        if cmd != "rank":
            p.add_argument("--mode", choices=["review", "auto", "draft"],
                           help="Override submit_mode from settings")
            p.add_argument("--force", action="store_true",
                           help="Process even URLs already logged as Applied")

    args = parser.parse_args(argv)

    config.check_api_key()
    settings = config.load_settings()
    profile = config.load_profile()
    master_resume = config.read_master_resume(profile)

    urls = _collect_urls(args)

    if args.command == "rank":
        print(f"Job agent: ranking {len(urls)} posting(s), model={settings.model}")
        try:
            rank(urls, settings, profile, master_resume)
        except KeyboardInterrupt:
            print("\nStopped by user.")
            return 1
        print("\nDone.")
        return 0

    mode = getattr(args, "mode", None)
    if args.command == "draft" or mode == "draft":
        settings.submit_mode = "draft"
    elif mode:
        settings.submit_mode = mode

    # Skip roles already submitted (unless --force), so re-running a list is safe.
    if settings.submit_mode != "draft" and not getattr(args, "force", False):
        done = applied_urls(config.resolve(settings.tracker_csv))
        before = len(urls)
        urls = [u for u in urls if u not in done]
        if before != len(urls):
            print(f"Skipping {before - len(urls)} already-applied URL(s). "
                  f"Use --force to include them.")

    if not urls:
        print("Nothing to do — all URLs already applied.")
        return 0

    print(f"Job agent: {len(urls)} posting(s), mode={settings.submit_mode}, "
          f"model={settings.model}")

    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] {url}")
        try:
            process_url(url, settings, profile, master_resume)
        except KeyboardInterrupt:
            print("\nStopped by user.")
            return 1
        except Exception as e:  # keep the batch going on per-URL failure
            print(f"  ERROR processing {url}: {e}")
            continue

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
