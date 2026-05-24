import os
import glob
import json

def undo_wrap(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Check if this file was incorrectly wrapped
    # It would be a dict with keys "subject", "chapter_title", "questions"
    # where the first element of "questions" is a Chapter (has "chapter_num" or "subject")
    if isinstance(data, dict) and "questions" in data:
        q_list = data["questions"]
        if len(q_list) > 0 and "chapter_title" in q_list[0]:
            print(f"Undoing wrap for {filepath}")
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(q_list, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    target_dir = 'd:/CGL-APP/src/data/mock_errors/*.json'
    files = glob.glob(target_dir)
    for f in files:
        undo_wrap(f)
    print("Done undoing wraps!")
