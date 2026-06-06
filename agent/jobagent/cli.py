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
from .runner import process_url


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
    return urls


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jobagent", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    for cmd in ("apply", "draft"):
        p = sub.add_parser(cmd, help=f"{cmd} to job posting URL(s)")
        p.add_argument("urls", nargs="*", help="Job posting URL(s)")
        p.add_argument("--file", help="Text file with one URL per line")
        p.add_argument("--mode", choices=["review", "auto", "draft"],
                       help="Override submit_mode from settings")

    args = parser.parse_args(argv)

    config.check_api_key()
    settings = config.load_settings()
    profile = config.load_profile()
    master_resume = config.read_master_resume(profile)

    if args.command == "draft" or args.mode == "draft":
        settings.submit_mode = "draft"
    elif args.mode:
        settings.submit_mode = args.mode

    urls = _collect_urls(args)
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
