#!/usr/bin/env python3
"""
修复 questions_bilingual.json 中 options_en 与 options_cn 选项数量不一致的问题。
多为「选择两个」题在英文提取时 D 和 E 被合并成一条（options_en 仅 4 键，options_cn 有 5 键）。
通过按 " E. " / " F. " 等拆分最后一个选项的文案，为 options_en 补全 E、F 等键，与 options_cn 对齐。

用法:
  python3 scripts/fix_options_en_mismatch.py
  python3 scripts/fix_options_en_mismatch.py public/data/questions_bilingual.json
  python3 scripts/fix_options_en_mismatch.py --dry-run  # 只报告，不写回
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATH = REPO_ROOT / "public" / "data" / "questions_bilingual.json"


def split_option_text(value: str, next_key: str) -> tuple[str, str] | None:
    """在 value 中按 " X. "（X 为下一选项键，如 E、F）拆成两段；若匹配则返回 (前段, 后段)，否则 None。"""
    if not value or not next_key:
        return None
    # 匹配 ". E. " 或 " E. "（E 为单字母键）
    pattern = re.compile(r"\.?\s*" + re.escape(next_key) + r"\.\s+", re.IGNORECASE)
    m = pattern.search(value)
    if not m:
        return None
    i = m.start()
    before = value[:i].strip().rstrip(".")
    after = value[m.end() :].strip()
    return (before, after) if before and after else None


def fix_item(item: dict) -> bool:
    """若 options_en 键数少于 options_cn，尝试拆分补全；有修改返回 True。"""
    opts_en = item.get("options_en") or {}
    opts_cn = item.get("options_cn") or {}
    keys_en = sorted(opts_en.keys())
    keys_cn = sorted(opts_cn.keys())
    if len(keys_en) >= len(keys_cn):
        return False
    # 缺的键：keys_cn 里有但 keys_en 里没有的
    missing = [k for k in keys_cn if k not in opts_en]
    if not missing or not keys_en:
        return False
    # 从 options_en 的最后一个键的值里按 " E. ", " F. " 等依次拆出 E、F、...
    updated = dict(opts_en)
    current_value = updated.get(keys_en[-1], "")
    for key in missing:
        pair = split_option_text(current_value, key)
        if not pair:
            break
        prev_key = keys_en[-1] if keys_en else None
        if prev_key is not None:
            updated[prev_key] = pair[0]
        updated[key] = pair[1]
        keys_en = sorted(updated.keys())
        current_value = pair[1]
    if len(updated) != len(opts_cn):
        return False
    item["options_en"] = updated
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description="修复 options_en 与 options_cn 选项数不一致")
    parser.add_argument("path", nargs="?", default=str(DEFAULT_PATH), help="questions_bilingual.json 路径")
    parser.add_argument("--dry-run", action="store_true", help="只报告会修改的题，不写回文件")
    args = parser.parse_args()

    path = Path(args.path).resolve()
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = [data]

    fixed_ids = []
    for item in data:
        if fix_item(item):
            fixed_ids.append(item.get("id", 0))

    if not fixed_ids:
        print("无需修复：没有 options_en 键数少于 options_cn 且可自动拆分的题。")
        return
    print(f"已修复（或拟修复）{len(fixed_ids)} 题，题号: {fixed_ids[:30]}{'...' if len(fixed_ids) > 30 else ''}")
    if args.dry_run:
        print("--dry-run：未写回文件。去掉 --dry-run 将写回。")
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已写回: {path}")


if __name__ == "__main__":
    main()
