import json
import os
import re
import shutil
from io import BytesIO

import fitz
import google.generativeai as genai
from PIL import Image

genai.configure(api_key="AQ.Ab8RN6J8XAebgeIJujBFZn_-5YZXx_pNgp8c2dg7qg4nzZ7FJw")

INPUT_FOLDER = r"D:\MY Project\ssc-cgl-practice-pro\pdfs"
DONE_FOLDER = os.path.join(INPUT_FOLDER, "done")
BASE_OUTPUT = r"D:\MY Project\ssc-cgl-practice-pro\src\data\chapter_bank"

os.makedirs(DONE_FOLDER, exist_ok=True)

model = genai.GenerativeModel("gemini-3.1-flash-lite-preview")

SUBJECT_FOLDER_MAP = {
    "mathematics": "mathematics",
    "english": "english",
    "reasoning": "reasoning",
    "general awareness": "general_awareness",
}

SUBJECT_ID_MAP = {
    "mathematics": "math",
    "english": "english",
    "reasoning": "reasoning",
    "general awareness": "gk",
}

PROMPT = """
Extract SSC-style MCQs from these PDF page images and return ONLY valid JSON.

Rules:
- Detect subject from: Mathematics, English, Reasoning, General Awareness
- Detect the chapter name correctly from the content
- Extract all MCQs you can confidently identify
- If an answer key is present, use it to fill the answer
- Keep options in keys: a, b, c, d
- Add a short solution when possible, otherwise keep it as ""
- Do not include markdown fences or commentary
- don leave any question extract as verbatim copy if any one question missed than project will fail

Format:
{
  "chapter_num": 1,
  "chapter_title": "<chapter>",
  "subject": "<subject>",
  "subject_id": "<id>",
  "questions": [
    {
      "q_num": 1,
      "question": "...",
      "options": {
        "a": "...",
        "b": "...",
        "c": "...",
        "d": "..."
      },
      "answer": "a",
      "solution": "..."
    }
  ]
}
"""


def normalize_name(name):
    name = (name or "").lower().strip()
    return re.sub(r"[^a-z0-9]+", "_", name).strip("_")


def normalize_subject(subject):
    return SUBJECT_FOLDER_MAP.get((subject or "").strip().lower())


def parse_model_json(text):
    cleaned = re.sub(r"```json|```", "", text or "").strip()
    return json.loads(cleaned)


def render_pdf_pages(pdf_path, zoom=2.0):
    images = []

    with fitz.open(pdf_path) as doc:
        matrix = fitz.Matrix(zoom, zoom)

        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            image = Image.open(BytesIO(pix.tobytes("png")))
            images.append(image)

    return images


def process_pdf(pdf_path):
    try:
        page_images = render_pdf_pages(pdf_path)

        if not page_images:
            raise ValueError("No pages were rendered from the PDF.")

        response = model.generate_content([PROMPT, *page_images])
        data = parse_model_json(response.text)

        if not isinstance(data, dict):
            raise ValueError("Model response is not a JSON object.")

        return data

    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
        return None


def list_existing_chapter_files(subject_folder):
    chapter_files = []

    if not os.path.isdir(subject_folder):
        return chapter_files

    for file_name in os.listdir(subject_folder):
        if re.fullmatch(r"chapter_\d+\.json", file_name):
            chapter_files.append(os.path.join(subject_folder, file_name))

    return sorted(chapter_files)


def get_chapter_file(subject_folder, chapter_title):
    existing_files = list_existing_chapter_files(subject_folder)
    normalized_title = normalize_name(chapter_title)

    for file_path in existing_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            continue

        if normalize_name(existing.get("chapter_title", "")) == normalized_title:
            return file_path, existing

    next_num = len(existing_files) + 1
    new_file_path = os.path.join(subject_folder, f"chapter_{next_num}.json")
    return new_file_path, None


def sanitize_question(question, fallback_num):
    options = question.get("options") or {}
    return {
        "q_num": fallback_num,
        "question": str(question.get("question", "")).strip(),
        "options": {
            "a": str(options.get("a", "")).strip(),
            "b": str(options.get("b", "")).strip(),
            "c": str(options.get("c", "")).strip(),
            "d": str(options.get("d", "")).strip(),
        },
        "answer": str(question.get("answer", "")).strip().lower(),
        "solution": str(question.get("solution", "")).strip(),
    }


def save_to_chapter(data):
    subject = str(data.get("subject", "")).strip()
    chapter_title = str(data.get("chapter_title", "Untitled Chapter")).strip()
    subject_folder_name = normalize_subject(subject)

    if not subject_folder_name:
        print(f"Unknown subject: {subject}")
        return

    subject_folder = os.path.join(BASE_OUTPUT, subject_folder_name)
    os.makedirs(subject_folder, exist_ok=True)

    chapter_file, existing = get_chapter_file(subject_folder, chapter_title)

    if existing is None:
        existing = {
            "chapter_num": data.get("chapter_num", 1),
            "chapter_title": chapter_title,
            "subject": subject,
            "subject_id": data.get("subject_id") or SUBJECT_ID_MAP.get(subject.lower(), ""),
            "questions": [],
        }

    existing_questions = existing.get("questions", [])
    new_questions = data.get("questions", [])
    existing_q_set = {q.get("question", "").strip().lower() for q in existing_questions}

    for question in new_questions:
        sanitized = sanitize_question(question, len(existing_questions) + 1)

        if not sanitized["question"]:
            continue

        if sanitized["question"].lower() in existing_q_set:
            continue

        existing_questions.append(sanitized)
        existing_q_set.add(sanitized["question"].lower())

    existing["chapter_title"] = chapter_title
    existing["subject"] = subject
    existing["subject_id"] = existing.get("subject_id") or SUBJECT_ID_MAP.get(subject.lower(), "")
    existing["questions"] = existing_questions

    chapter_match = re.search(r"chapter_(\d+)\.json$", chapter_file)
    existing["chapter_num"] = int(chapter_match.group(1)) if chapter_match else int(data.get("chapter_num", 1))

    for index, question in enumerate(existing["questions"], start=1):
        question["q_num"] = index

    with open(chapter_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2)

    print(f"Saved -> {chapter_file}")


def move_to_done(file_path):
    filename = os.path.basename(file_path)
    destination = os.path.join(DONE_FOLDER, filename)
    shutil.move(file_path, destination)
    print(f"Moved to done -> {filename}")


def run():
    for file_name in os.listdir(INPUT_FOLDER):
        file_path = os.path.join(INPUT_FOLDER, file_name)

        if not os.path.isfile(file_path):
            continue

        if not file_name.lower().endswith(".pdf"):
            continue

        print(f"\nProcessing: {file_name}")
        data = process_pdf(file_path)

        if data:
            save_to_chapter(data)
            move_to_done(file_path)
        else:
            print(f"Skipped: {file_name}")


if __name__ == "__main__":
    run()
