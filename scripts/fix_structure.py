import os
import glob
import json

def fix_json_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Skipping {filepath} due to JSON decode error")
            return

    # If the data is a list (plain array of questions), we need to wrap it
    if isinstance(data, list):
        # Extract topic from the path
        # Example path: d:/CGL-APP/src/data/chapter_bank/mathematics/spartan/average/set_1.json
        parts = filepath.replace('\\', '/').split('/')
        
        # topic_name is the parent folder of the json file
        topic_name = parts[-2].replace('_', ' ').title()
        
        # subject is usually 'Mathematics' for these folders
        # We can guess subject from path parts, e.g., parts[-4]
        # let's just default to 'Mathematics' since we are mostly dealing with that
        subject = "Mathematics"
        if "community_medicine" in filepath:
            subject = "Community Medicine"

        wrapped_data = {
            "subject": subject,
            "chapter_title": topic_name,
            "questions": data
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(wrapped_data, f, indent=2, ensure_ascii=False)
        print(f"Fixed structure for {filepath}")

if __name__ == "__main__":
    target_dir = 'd:/CGL-APP/src/data/**/*.json'
    files = glob.glob(target_dir, recursive=True)
    
    for f in files:
        fix_json_file(f)
    
    print("Done fixing JSON structures!")
