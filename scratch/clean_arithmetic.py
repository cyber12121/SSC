import json
import os

DATA_PATH = r"d:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors\mathematics.json"

if os.path.exists(DATA_PATH):
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    arithmetic_ch = None
    ratio_ch = None
    
    for ch in data:
        if ch['chapter_title'] == 'Arithmetic':
            arithmetic_ch = ch
        if ch['chapter_title'] == 'Ratio and Proportion':
            ratio_ch = ch

    if arithmetic_ch:
        if not ratio_ch:
            # Create Ratio and Proportion if it doesn't exist (unlikely but safe)
            ratio_ch = {
                "chapter_num": len(data) + 1,
                "chapter_title": "Ratio and Proportion",
                "subject": arithmetic_ch.get("subject", "Mathematics"),
                "subject_id": arithmetic_ch.get("subject_id", "mathematics"),
                "questions": []
            }
            data.append(ratio_ch)

        # Move questions
        for q in arithmetic_ch.get('questions', []):
            if "Sample" in q.get('question', ''):
                print(f"Skipping sample question: {q.get('question')}")
                continue
            
            # Avoid duplicates
            existing_q_texts = {ex_q["question"] for ex_q in ratio_ch["questions"]}
            if q["question"] not in existing_q_texts:
                q["q_num"] = len(ratio_ch["questions"]) + 1
                ratio_ch["questions"].append(q)
                print(f"Moved question: {q['question'][:50]}...")

        # Remove Arithmetic chapter
        data = [ch for ch in data if ch['chapter_title'] != 'Arithmetic']
        
        # Re-index chapter numbers
        for i, ch in enumerate(data):
            ch["chapter_num"] = i + 1

        with open(DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        print("Successfully removed Arithmetic chapter and moved valid questions.")
    else:
        print("Arithmetic chapter not found.")
else:
    print("mathematics.json not found.")
