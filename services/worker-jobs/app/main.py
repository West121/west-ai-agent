from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.tasks import run_knowledge_index_job, run_smoke_job


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worker-jobs")
    parser.add_argument(
        "--job",
        default="smoke",
        choices=["smoke", "knowledge-index"],
        help="Task to run.",
    )
    parser.add_argument(
        "--input",
        help="JSON input file for knowledge-index job.",
    )
    args = parser.parse_args(argv)

    if args.job == "smoke":
        print(run_smoke_job())
    if args.job == "knowledge-index":
        if not args.input:
            raise SystemExit("--input is required for knowledge-index")
        payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
        print(json.dumps(run_knowledge_index_job(payload), ensure_ascii=False, sort_keys=True))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
