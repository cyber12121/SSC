import json
import os

data_dir = r"d:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors"
files = ["english.json", "general_awareness.json", "mathematics.json", "reasoning.json"]

for file_name in files:
    path = os.path.join(data_dir, file_name)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            chapters = [ch.get('chapter_title', 'Unknown') for ch in data]
            print(f"--- {file_name} ---")
            for ch in sorted(set(chapters)):
                count = sum(1 for c in data if c.get('chapter_title') == ch)
                print(f"{ch} ({count})")
