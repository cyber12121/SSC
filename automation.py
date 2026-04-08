import os
import json
import shutil
from PIL import Image
import google.generativeai as genai

# ================= CONFIG =================

genai.configure(api_key="AIzaSyAiyMCqx--__gIsFQWgN6QQw5f_2aVcZAE")

INPUT_FOLDER = r"D:\MY Project\ssc-cgl-practice-pro\Screenshots"
DONE_FOLDER = os.path.join(INPUT_FOLDER, "done")
OUTPUT_FOLDER = r"D:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors"

os.makedirs(DONE_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

FILE_MAP = {
    "Mathematics": "mathematics.json",
    "Quantitative Aptitude": "mathematics.json",
    "Quantitative Aptitude (Maths)": "mathematics.json",
    "General Awareness": "general_awareness.json",
    "English": "english.json",
    "English Language": "english.json",
    "Reasoning": "reasoning.json",
    "General Intelligence & Reasoning": "reasoning.json"
}

PROMPT = """
You are an AI that extracts structured data from exam screenshots.

Rules:
- Identify subject (Quantitive Aptitude, General Awareness, English, Reasoning)
- Infer chapter name form below list
Quantitative Aptitude
Arithmetic:
Number System & Decimals and Fractions
Percentage
Ratio and Proportion
Average
Simple and Compound Interest
Profit, Loss and Discount
Time and Work
Pipe and Cistern
Time, Speed and Distance
Boat and Streams
Races and Games
Mixture and Alligation
Partnership
Algebra 
geometry
Mensuration 2D and 3D
Trigonometry
Heights and Distances
Data Interpretation
Statistics and Probability

--------------------
General Intelligence & Reasoning

Analogy
Classification
Number Series
Alphabet Series
Coding-Decoding
Blood Relations
Direction Sense
Syllogism
Venn Diagrams
Order and Ranking
Seating Arrangement
Mathematical Operations
Puzzles
Clock and Calendar
Mirror and Water Images
Paper Folding and Unfolding
Pattern Completion
Embedded Figures
Figural Series
Dice and Cubes
Critical Thinking
---------------------
English Language
Synonyms and Antonyms
One Word Substitution
Idioms and Phrases
Homonyms
Spelling Correction
Error Spotting & Sentence Improvement
Active and Passive Voice
Direct and Indirect Speech
Parts of Speech
Subject-Verb Agreement
Articles
Reading & Ability:
Reading Comprehension
Cloze Test and fill in the blank
Para Jumbles


- Extract question and options
- The GREEN highlighted option OR ✓ mark is the correct answer
- Return ONLY valid JSON (no explanation)
- if it is form englsih in solution explain all the option 
- for english explain all the option in solution
Format:
{
  "<Subject Name>": [
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
  ]
}
"""

model = genai.GenerativeModel("gemini-3.1-flash-lite-preview")

# ================= CORE FUNCTIONS =================

def process_image(image_path):
    try:
        img = Image.open(image_path)

        response = model.generate_content([PROMPT, img])
        text = response.text.strip()

        # Remove markdown if present
        if text.startswith("```"):
            text = text.split("```")[1]

        data = json.loads(text)
        return data

    except Exception as e:
        print(f"❌ Error processing {image_path}: {e}")
        return None


def save_to_file(data):
    for subject, chapters in data.items():

        if subject not in FILE_MAP:
            print(f"⚠️ Unknown subject: {subject}")
            continue

        file_path = os.path.join(OUTPUT_FOLDER, FILE_MAP[subject])

        # Load existing data
        if os.path.exists(file_path):
            try:
                with open(file_path, "r") as f:
                    existing = json.load(f)
            except:
                existing = []
        else:
            existing = []

        # Support both legacy object format: {"Subject": [...]} and
        # current list format: [...]
        if isinstance(existing, dict):
            existing_chapters = existing.get(subject, [])
        elif isinstance(existing, list):
            existing_chapters = existing
        else:
            existing_chapters = []

        for new_ch in chapters:
            found = False

            for ex_ch in existing_chapters:
                if ex_ch["chapter_title"].strip().lower() == new_ch["chapter_title"].strip().lower():

                    # ✅ Merge questions (avoid duplicates)
                    existing_questions = ex_ch.get("questions", [])
                    new_questions = new_ch.get("questions", [])

                    existing_q_texts = {q["question"] for q in existing_questions}

                    for nq in new_questions:
                        if nq["question"] not in existing_q_texts:
                            existing_questions.append(nq)

                    ex_ch["questions"] = existing_questions
                    found = True
                    break

            if not found:
                existing_chapters.append(new_ch)

        with open(file_path, "w") as f:
            json.dump(existing_chapters, f, indent=2)

        print(f"✅ Updated → {file_path}")


def move_to_done(file_path):
    filename = os.path.basename(file_path)
    dest_path = os.path.join(DONE_FOLDER, filename)

    shutil.move(file_path, dest_path)
    print(f"📁 Moved to done → {filename}")


def process_all_images():
    # Only images
    files_to_process = [f for f in os.listdir(INPUT_FOLDER) 
                        if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    
    if not files_to_process:
        print("📭 No images found in Screenshots folder.")
        return

    MAX_RETRIES = 3
    # Initial Pass + 3 Retries = 4 attempts in the main loop
    for attempt in range(1, MAX_RETRIES + 2):
        if not files_to_process:
            break
            
        status_msg = "🚀 Initial Pass" if attempt == 1 else f"🔄 Retry {attempt-1}"
        print(f"\n{status_msg} (Total Attempts Permitted: {MAX_RETRIES + 1})")
        print(f"Files to process: {len(files_to_process)}")

        failed_files = []
        for file in files_to_process:
            file_path = os.path.join(INPUT_FOLDER, file)
            print(f"📸 Processing: {file}")

            data = process_image(file_path)

            if data:
                save_to_file(data)
                move_to_done(file_path)
            else:
                failed_files.append(file)
                print(f"⚠️ Failed/Skipped: {file}")

        files_to_process = failed_files

    # Final "Leftover" processing pass
    if files_to_process:
        print(f"\n🏁 Final Leftover Processing Pass (The 'One Last Try')...")
        final_failed = []
        for file in files_to_process:
            file_path = os.path.join(INPUT_FOLDER, file)
            print(f"📸 Final Attempt: {file}")
            data = process_image(file_path)
            if data:
                save_to_file(data)
                move_to_done(file_path)
            else:
                final_failed.append(file)

        if final_failed:
            print(f"\n❌ Final Status: {len(final_failed)} files could not be processed after all attempts.")
            for f in final_failed:
                print(f"   - {f}")
        else:
            print("\n✨ All files processed successfully in the final pass!")
    else:
        print("\n✨ All files processed successfully!")


# ================= RUN =================

if __name__ == "__main__":
    process_all_images()
