#!/usr/bin/env python3
"""
阶段 2：用 Gemini 2 Flash Lite 将 raw_questions_en.json 翻译成中文（术语保留英文），
保持可读性与准确度，输出 questions_bilingual.json。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/translate_en_to_cn.py
  python3 scripts/translate_en_to_cn.py public/data/raw_questions_en.json public/data/questions_bilingual.json
  python3 scripts/translate_en_to_cn.py --resume  # 从上次进度继续（每 50 题自动断点）
  python3 scripts/translate_en_to_cn.py --limit 5  # 先试跑 5 题
  python3 scripts/translate_en_to_cn.py --retry-failed  # 只重试失败题，每 15 题一批 API，减少 429
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# 429/限流时重试：最多重试次数、每次等待秒数
RETRY_MAX = 4
RETRY_WAIT_SEC = [60, 120, 180, 300]  # 第 1~4 次重试前等待
BASE_SLEEP_SEC = 1.0  # 每题之间的基础间隔，降低触发限流
# --retry-failed 时每批题数，减少 API 调用次数以降低 429
RETRY_BATCH_SIZE = 15

# 优先使用新版 google-genai；若无则用旧版 google-generativeai
USE_NEW_GENAI = False
try:
    from google import genai as genai_new
    USE_NEW_GENAI = True
except ImportError:
    try:
        import google.generativeai as genai_old
    except ImportError:
        print("请先安装: pip install google-genai  或  pip install google-generativeai")
        sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "public" / "data" / "raw_questions_en.json"
DEFAULT_OUTPUT = REPO_ROOT / "public" / "data" / "questions_bilingual.json"
PROGRESS_FILE = REPO_ROOT / "public" / "data" / ".translate_progress.json"

# 翻译时保留英文的专有名词/产品名（可增补）；描述性短语译成中文
KEEP_ENGLISH = (
    "Amazon S3, S3, AWS Lambda, Amazon DynamoDB, Amazon EMR, Amazon SQS, Amazon EC2, "
    "Amazon Aurora, Amazon Redshift, Amazon Athena, Amazon Kinesis, Amazon EventBridge, "
    "Amazon CloudWatch, AWS Glue, Amazon EFS, Amazon EBS, Amazon Elastic Block Store, "
    "VPC, IAM, Lambda, DynamoDB, EMR, SQS, EC2, Aurora, Redshift, Athena, Kinesis, "
    "EventBridge, CloudWatch, Glue, EFS, EBS, JSON, SQL, NFS, API, HTTPS, VPC endpoint, "
    "Application Load Balancer, ALB, NAT Gateway, Direct Connect, Snowball, AWS Snowball Edge, "
    "S3 Transfer Acceleration, multipart uploads"
)

# 必须译成中文的短语（产品名保留英文，描述性短语用中文）
MUST_TRANSLATE = (
    "Storage Optimized device → 存储优化设备 (e.g. AWS Snowball Edge 存储优化设备); "
    "Cross-Region Replication → 跨区域复制 (e.g. S3 跨区域复制); "
    "source bucket → 源 S3 存储桶 (NOT 原始); "
    "Enable on the target bucket → 打开目标 S3 存储桶的; "
    "at regular intervals → 定期间隔"
)


def get_client_or_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("请设置环境变量 GEMINI_API_KEY")
        sys.exit(1)
    if USE_NEW_GENAI:
        return genai_new.Client(api_key=api_key), "new"
    genai_old.configure(api_key=api_key)
    return genai_old.GenerativeModel("gemini-2.0-flash-lite"), "old"


def build_prompt(question_en: str, options_en: dict) -> str:
    opts = "\n".join(f"{k}. {v}" for k, v in sorted(options_en.items()))
    return f"""You are a translator. Translate the following AWS certification exam question and options from English to Simplified Chinese.

Rules:
1. Keep ONLY AWS/product names and core terms in English: {KEEP_ENGLISH}
   Do NOT leave in English: "Storage Optimized", "Cross-Region Replication", or "source" (use 源).
2. You MUST use these Chinese phrases where applicable: {MUST_TRANSLATE}
3. Use natural Simplified Chinese for the rest (e.g. 将数据从每个站点上传到, 定期间隔，拍摄 EBS 快照).
4. Return ONLY a valid JSON object. Keys: "question_cn" (string), "options_cn" (object with A,B,C,D).

Question:
{question_en}

Options:
{opts}

JSON:"""


def build_batch_prompt(items: list[dict]) -> str:
    """多题一批的 prompt，要求返回 JSON 数组，顺序与输入一致。"""
    parts = []
    for i, item in enumerate(items, 1):
        q = item.get("question_en", "")
        opts = item.get("options_en", {})
        opts_str = "\n   ".join(f"{k}. {v}" for k, v in sorted(opts.items()))
        parts.append(f"--- 题目 {i} ---\n题干: {q}\n选项:\n   {opts_str}")
    body = "\n\n".join(parts)
    return f"""You are a translator. Translate the following AWS certification exam questions from English to Simplified Chinese.

Rules:
1. Keep ONLY AWS/product names and core terms in English: {KEEP_ENGLISH}
   Do NOT leave in English: "Storage Optimized", "Cross-Region Replication", or "source" (use 源).
2. You MUST use these Chinese phrases where applicable: {MUST_TRANSLATE}
3. Use natural Simplified Chinese for the rest.
4. Return ONLY a valid JSON array. The array must have exactly {len(items)} elements, in the same order as the input (题目 1 → index 0, 题目 2 → index 1, ...). Each element is an object with exactly two keys: "question_cn" (string), "options_cn" (object with keys A, B, C, D).

Input:

{body}

JSON array:"""


def parse_response(text: str) -> dict | None:
    text = text.strip()
    # 去掉可能的 markdown 代码块
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def parse_batch_response(text: str, expected_len: int) -> list[dict] | None:
    """解析多题一批的 JSON 数组，长度须与 expected_len 一致。"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        arr = json.loads(text)
        if not isinstance(arr, list) or len(arr) != expected_len:
            return None
        for i, o in enumerate(arr):
            if not isinstance(o, dict) or "question_cn" not in o or "options_cn" not in o:
                return None
        return arr
    except (json.JSONDecodeError, TypeError):
        return None


def load_progress() -> tuple[list, int]:
    if not PROGRESS_FILE.exists():
        return [], 0
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return data.get("items", []), data.get("last_index", 0)
    except Exception:
        return [], 0


def is_failed_item(item: dict) -> bool:
    """题干仍是英文（429 等失败时保留英文）视为需重试"""
    qcn = item.get("question_cn") or ""
    qen = item.get("question_en") or ""
    return not qcn.strip() or qcn.strip() == qen.strip()


def save_progress(items: list, last_index: int):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(
        json.dumps({"items": items, "last_index": last_index}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _translate_one(client_or_model, sdk: str, item: dict) -> dict:
    """翻译单题，失败则保留英文。返回更新后的 item。"""
    qid = item.get("id", 0)
    question_en = item.get("question_en", "")
    options_en = item.get("options_en", {})
    prompt = build_prompt(question_en, options_en)
    for attempt in range(RETRY_MAX + 1):
        try:
            if sdk == "new":
                response = client_or_model.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=prompt,
                )
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            else:
                response = client_or_model.generate_content(prompt)
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            parsed = parse_response(text)
            if parsed and "question_cn" in parsed and "options_cn" in parsed:
                return {**item, "question_cn": parsed["question_cn"], "options_cn": parsed["options_cn"]}
            return {**item, "question_cn": question_en, "options_cn": options_en}
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_rate_limit and attempt < RETRY_MAX:
                wait = RETRY_WAIT_SEC[attempt]
                print(f"  [429/限流] 题 {qid}，{wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                time.sleep(wait)
            else:
                print(f"  [ERROR] 题 {qid}: {e}")
                return {**item, "question_cn": question_en, "options_cn": options_en}
    return {**item, "question_cn": question_en, "options_cn": options_en}


def _translate_batch(client_or_model, sdk: str, items: list[dict]) -> list[dict]:
    """每批最多 RETRY_BATCH_SIZE 题调用一次 API；失败或解析异常则逐题回退。返回更新后的 items。"""
    n = len(items)
    prompt = build_batch_prompt(items)
    for attempt in range(RETRY_MAX + 1):
        try:
            if sdk == "new":
                response = client_or_model.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=prompt,
                )
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            else:
                response = client_or_model.generate_content(prompt)
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            parsed_list = parse_batch_response(text, n)
            if parsed_list:
                return [
                    {**item, "question_cn": p["question_cn"], "options_cn": p["options_cn"]}
                    for item, p in zip(items, parsed_list)
                ]
            # 解析失败则逐题回退
            print(f"  [WARN] 本批 {n} 题解析异常，改为逐题请求")
            return [_translate_one(client_or_model, sdk, item) for item in items]
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_rate_limit and attempt < RETRY_MAX:
                wait = RETRY_WAIT_SEC[attempt]
                ids_str = ",".join(str(item.get("id", i)) for i, item in enumerate(items))
                print(f"  [429/限流] 本批题 {ids_str}，{wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                time.sleep(wait)
            else:
                print(f"  [ERROR] 本批 {n} 题: {e}，改为逐题请求")
                return [_translate_one(client_or_model, sdk, item) for item in items]
    return [
        {**item, "question_cn": item.get("question_en", ""), "options_cn": item.get("options_en", {})}
        for item in items
    ]


def _run_retry_failed(client_or_model, sdk: str, output_path: Path):
    """只重试失败题；每 RETRY_BATCH_SIZE 题调用一次 API，减少 429。"""
    if PROGRESS_FILE.exists():
        done_items, last_index = load_progress()
        source = "进度"
    else:
        if not output_path.exists():
            print(f"未找到进度或输出文件，无法 --retry-failed。请先跑完翻译或 --resume。")
            return
        done_items = json.loads(output_path.read_text(encoding="utf-8"))
        if not isinstance(done_items, list):
            done_items = [done_items]
        last_index = len(done_items)
        source = "输出"
    failed_indices = [i for i in range(len(done_items)) if is_failed_item(done_items[i])]
    if not failed_indices:
        print(f"当前 {source} 中无失败题，无需重试。")
        return
    print(f"从 {source} 中检出 {len(failed_indices)} 题需重试，每 {RETRY_BATCH_SIZE} 题一批调用 API")
    # 按批处理
    for start in range(0, len(failed_indices), RETRY_BATCH_SIZE):
        chunk = failed_indices[start : start + RETRY_BATCH_SIZE]
        batch_items = [done_items[i] for i in chunk]
        updated = _translate_batch(client_or_model, sdk, batch_items)
        for j, idx in enumerate(chunk):
            done_items[idx] = updated[j]
        batch_no = start // RETRY_BATCH_SIZE + 1
        total_batches = (len(failed_indices) + RETRY_BATCH_SIZE - 1) // RETRY_BATCH_SIZE
        print(f"  已重试第 {batch_no}/{total_batches} 批（本批 {len(chunk)} 题）")
        time.sleep(BASE_SLEEP_SEC)
    if PROGRESS_FILE.exists():
        save_progress(done_items, last_index)
        print(f"已更新进度，共 {len(done_items)} 题，断点第 {last_index} 题。")
    else:
        output_path.write_text(json.dumps(done_items, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已写入: {output_path}，共 {len(done_items)} 题。")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Translate raw_questions_en.json to Chinese with Gemini")
    parser.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="Input JSON path")
    parser.add_argument("output", nargs="?", default=str(DEFAULT_OUTPUT), help="Output JSON path")
    parser.add_argument("--resume", action="store_true", help="Resume from last progress")
    parser.add_argument("--limit", type=int, default=0, help="Max questions to translate (0 = all)")
    parser.add_argument("--retry-failed", action="store_true", help="Only re-translate items that failed (429, etc.)")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    if not input_path.exists():
        print(f"输入文件不存在: {input_path}")
        sys.exit(1)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client_or_model, sdk = get_client_or_model()
    print("使用: Gemini 2 Flash Lite (SDK:", "google-genai" if sdk == "new" else "google-generativeai", ")")

    # --retry-failed：只重试失败题（从进度或最终 json 里找出 question_cn == question_en 的题）
    if args.retry_failed:
        _run_retry_failed(client_or_model, sdk, output_path)
        return

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raw = [raw]

    done_items, last_index = load_progress() if args.resume else ([], 0)
    if args.resume and done_items:
        print(f"从进度恢复: 已完成 {len(done_items)} 题，从第 {last_index + 1} 题继续")
    else:
        last_index = 0
        done_items = []

    end_index = len(raw) if args.limit <= 0 else min(last_index + args.limit, len(raw))

    for i in range(last_index, end_index):
        item = raw[i]
        qid = item.get("id", i + 1)
        question_en = item.get("question_en", "")
        options_en = item.get("options_en", {})
        if not question_en and not options_en:
            done_items.append(item)
            continue
        prompt = build_prompt(question_en, options_en)
        last_error = None
        for attempt in range(RETRY_MAX + 1):
            try:
                if sdk == "new":
                    response = client_or_model.models.generate_content(
                        model="gemini-2.0-flash-lite",
                        contents=prompt,
                    )
                    text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
                else:
                    response = client_or_model.generate_content(prompt)
                    text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
                parsed = parse_response(text)
                if parsed and "question_cn" in parsed and "options_cn" in parsed:
                    out = {**item, "question_cn": parsed["question_cn"], "options_cn": parsed["options_cn"]}
                    done_items.append(out)
                else:
                    print(f"  [WARN] 题 {qid} 解析失败，保留英文")
                    done_items.append({**item, "question_cn": question_en, "options_cn": options_en})
                last_error = None
                break
            except Exception as e:
                last_error = e
                err_str = str(e)
                is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
                if is_rate_limit and attempt < RETRY_MAX:
                    wait = RETRY_WAIT_SEC[attempt]
                    print(f"  [429/限流] 题 {qid}，{wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                    time.sleep(wait)
                else:
                    print(f"  [ERROR] 题 {qid}: {e}")
                    done_items.append({**item, "question_cn": question_en, "options_cn": options_en})
                    break
        # 每 50 题为 1 set 断点保存，便于 --resume 续跑
        if (i + 1) % 50 == 0:
            save_progress(done_items, i + 1)
            print(f"  已处理 {i + 1}/{end_index} 题，已保存断点（第 {i + 1} 题）")
        time.sleep(BASE_SLEEP_SEC)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(done_items, f, ensure_ascii=False, indent=2)
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
    print(f"已写入: {output_path}，共 {len(done_items)} 题")


if __name__ == "__main__":
    main()
