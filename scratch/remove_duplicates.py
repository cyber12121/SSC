import json
import os
import re

def normalize(text):
    if not text:
        return ""
    # Remove common instructions/prefixes
    text = re.sub(r'^(Select the|Choose the|Direction:|Directions:|In the question,|Read each sentence|From the given|Identify the|What will come in blank|Change the sentence from|What is the).*?[\.:?]\s*', '', text, flags=re.IGNORECASE)
    # Lowercase
    text = text.lower()
    # Remove all non-alphanumeric
    text = re.sub(r'[^a-zA-Z0-9]', '', text)
    return text

def remove_duplicates(folder_path):
    files = [f for f in os.listdir(folder_path) if f.endswith('.json')]
    
    for file in files:
        file_path = os.path.join(folder_path, file)
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        print(f"Cleaning {file}...")
        seen_norm = set()
        cleaned_data = []
        removed_count = 0
        
        for chapter in data:
            new_questions = []
            for q in chapter.get('questions', []):
                q_text = q.get('question', '')
                norm_text = normalize(q_text)
                
                if norm_text in seen_norm:
                    removed_count += 1
                    continue
                
                if norm_text:
                    seen_norm.add(norm_text)
                new_questions.append(q)
            
            # Update chapter questions
            chapter['questions'] = new_questions
            # Only keep chapter if it still has questions (optional, but cleaner)
            if new_questions:
                cleaned_data.append(chapter)
        
        if removed_count > 0:
            print(f"  Removed {removed_count} duplicates.")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
        else:
            print("  No duplicates found.")

if __name__ == "__main__":
    folder = r"d:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors"
    # Create backup folder first manually or via script
    backup_folder = os.path.join(folder, "backup")
    if not os.path.exists(backup_folder):
        os.makedirs(backup_folder)
        import shutil
        for f in os.listdir(folder):
            if f.endswith('.json'):
                shutil.copy(os.path.join(folder, f), os.path.join(backup_folder, f))
        print("Backups created in 'backup' folder.")
    
    remove_duplicates(folder)
