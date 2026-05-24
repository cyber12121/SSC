import json
import glob
import re
import os

def has_hindi(text):
    return bool(re.search(r'[\u0900-\u097F]', text))

def clean_text(text):
    if not isinstance(text, str):
        return text
    
    # 1. Handle Questions/Solutions (multi-line)
    # Split by newlines and keep lines that don't have Hindi
    lines = text.split('\n')
    clean_lines = []
    for line in lines:
        if not has_hindi(line):
            clean_lines.append(line)
    
    # Rejoin the lines
    text = '\n'.join(clean_lines).strip()
    
    # 2. Handle Options (single line, often separated by / or | or - )
    # E.g. "Will decrease by 1 / 1 की कमी होगी"
    if has_hindi(text):
        # If it still has hindi (maybe it was on the same line)
        # Try to split by '/' and keep the english part
        if '/' in text:
            parts = text.split('/')
            english_parts = [p.strip() for p in parts if not has_hindi(p)]
            if english_parts:
                text = ' / '.join(english_parts)
        
        # If it STILL has hindi, fallback to regex removal of hindi characters
        if has_hindi(text):
            # remove hindi characters
            text = re.sub(r'[\u0900-\u097F]+', '', text)
            # remove dangling punctuation that might be left over
            text = text.replace('  ', ' ').strip(' /-|')

    return text.strip()

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for item in data:
        item['question'] = clean_text(item.get('question', ''))
        
        options = item.get('options', {})
        for k, v in options.items():
            options[k] = clean_text(v)
            
        item['solution'] = clean_text(item.get('solution', ''))
        
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    target_dir = 'd:/CGL-APP/src/data/chapter_bank/mathematics/spartan/average/*.json'
    files = glob.glob(target_dir)
    
    if not files:
        print("No JSON files found to clean.")
    
    for f in files:
        print(f"Cleaning {os.path.basename(f)}...")
        process_file(f)
        
    print("Done! Hindi text removed.")
