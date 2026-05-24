import os
import re
import json
import math

ANSWERS_FILE = r"d:\CGL-APP\pdfs\Pinnacle\answer.txt"
QUESTIONS_FILE = r"d:\CGL-APP\pdfs\Pinnacle\nosystem_final.txt"
OUTPUT_DIR = r"d:\CGL-APP\src\data\chapter_bank\mathematics\pinnacle\number_system"

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # 1. Parse answers
    answers = {}
    with open(ANSWERS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if '---' in line:
                parts = line.split('---')
                q_num = parts[0].strip()
                ans = parts[1].strip()
                answers[q_num] = ans

    # 2. Parse questions
    with open(QUESTIONS_FILE, 'r', encoding='utf-8') as f:
        text = f.read()

    # Find all question blocks. 
    # Starts with Q.number. and goes until the next Q.number. or end of file
    pattern = re.compile(r'Q\.(\d+)\.\s+(.*?)(?=\nQ\.\d+\.\s+|\Z)', re.DOTALL)
    matches = pattern.findall(text)

    parsed_questions = []
    
    # Options pattern
    # Greedy (.*) will match everything up to the LAST (a), which is exactly what we want 
    # to avoid capturing an (a) that might be in the question body.
    opt_pattern = re.compile(r'(.*)\(a\)\s*(.*?)\s*\(b\)\s*(.*?)\s*\(c\)\s*(.*?)\s*\(d\)\s*(.*)', re.DOTALL)

    for match in matches:
        q_num = match[0]
        block = match[1]

        opt_match = opt_pattern.search(block)
        
        if opt_match:
            q_text = opt_match.group(1).strip()
            opt_a = opt_match.group(2).strip()
            opt_b = opt_match.group(3).strip()
            opt_c = opt_match.group(4).strip()
            opt_d = opt_match.group(5).strip()
        else:
            q_text = block.strip()
            opt_a = ""
            opt_b = ""
            opt_c = ""
            opt_d = ""

        ans = answers.get(q_num, None)
        
        q_obj = {
            "q_num": int(q_num),
            "question": q_text,
            "options": {
                "a": opt_a,
                "b": opt_b,
                "c": opt_c,
                "d": opt_d
            },
            "answer": ans,
            "solution": ""
        }
        parsed_questions.append(q_obj)

    print(f"Parsed {len(parsed_questions)} questions.")

    # 3. Chunk and Save
    chunk_size = 50
    total_sets = math.ceil(len(parsed_questions) / chunk_size)

    for i in range(total_sets):
        start_idx = i * chunk_size
        end_idx = start_idx + chunk_size
        chunk = parsed_questions[start_idx:end_idx]
        
        set_num = i + 1
        output_file = os.path.join(OUTPUT_DIR, f"set_{set_num}.json")
        
        wrapper = {
            "subject": "Mathematics",
            "chapter_title": "Number System",
            "questions": chunk
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(wrapper, f, indent=2, ensure_ascii=False)
            
        print(f"Saved {len(chunk)} questions to {output_file}")

if __name__ == "__main__":
    main()
