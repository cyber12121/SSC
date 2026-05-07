import json
import os

# Paths
DATA_DIR = r"d:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors"
FILES = {
    "mathematics": "mathematics.json",
    "english": "english.json",
    "reasoning": "reasoning.json",
    "general_awareness": "general_awareness.json"
}

# Mapping Rules
# Key: New Chapter Title, Value: List of Old Chapter Titles to merge into it
MAPPING = {
    "mathematics.json": {
        "Number System": ["Number System", "HCF and LCM", "Decimals and Fractions", "number system & decimals and fractions"],
        "Time and Work": ["Time and Work", "Pipe and Cistern"],
        "Time, Speed and Distance": ["Time, Speed and Distance", "Boat and Streams", "Races and Games", "Boat and Stream"],
        "Trigonometry": ["Trigonometry", "Heights and Distances"],
        "Statistics and Probability": ["Statistics and Probability", "Statistics"],
        "Geometry": ["Geometry"], # Coordinate Geometry stays separate
        "Coordinate Geometry": ["Coordinate Geometry"]
    },
    "english.json": {
        "Vocabulary": [
            "Vocabulary", "Synonyms and Antonyms", "One Word Substitution", 
            "Idioms and Phrases", "Phrasal Verbs", "Spelling Correction", 
            "Homonyms", "vocabulary", "antonyms", "spelling", "idioms and phrases"
        ],
        "Error Spotting & Sentence Improvement": [
            "Error Spotting & Sentence Improvement", "Sentence Improvement", 
            "Error Spotting", "Grammar", "adjective", "prepositions", 
            "subject-verb agreement", "spotting errors", "sentence improvement"
        ]
    },
    "reasoning.json": {
        "Non-Verbal Reasoning": [
            "Non-Verbal Reasoning", "Mirror Images", "Water Images", 
            "Mirror and Water Images", "Paper Folding and Unfolding", 
            "Pattern Completion", "Embedded Figures", "Figural Series", 
            "Paper Folding", "Embedded Figure"
        ],
        "Critical Thinking": [
            "Critical Thinking", "Statement and Assumptions", 
            "Statement and Conclusion", "Statement and Arguments", 
            "Course of Action", "statement and assumptions", "statement and conclusion"
        ]
    }
}

def migrate_file(file_name):
    path = os.path.join(DATA_DIR, file_name)
    if not os.path.exists(path):
        print(f"Skipping {file_name} (not found)")
        return

    print(f"Processing {file_name}...")
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list):
        print(f"Error: {file_name} is not a list")
        return

    # Inverted map for easier lookup: old_title -> new_title
    file_mapping = MAPPING.get(file_name, {})
    old_to_new = {}
    for new_title, old_titles in file_mapping.items():
        for ot in old_titles:
            old_to_new[ot.strip().lower()] = new_title

    new_chapters_dict = {} # new_title -> chapter_obj

    for ch_obj in data:
        title = ch_obj.get('chapter_title', '').strip()
        title_lower = title.lower()
        
        target_title = old_to_new.get(title_lower, title)
        
        if target_title not in new_chapters_dict:
            # Create new chapter entry
            new_chapters_dict[target_title] = {
                "chapter_num": ch_obj.get("chapter_num", 1),
                "chapter_title": target_title,
                "subject": ch_obj.get("subject", ""),
                "subject_id": ch_obj.get("subject_id", ""),
                "questions": []
            }
        
        # Merge questions
        existing_questions = new_chapters_dict[target_title]["questions"]
        new_questions = ch_obj.get("questions", [])
        
        existing_q_texts = {q["question"] for q in existing_questions}
        for nq in new_questions:
            if nq["question"] not in existing_q_texts:
                nq["q_num"] = len(existing_questions) + 1
                existing_questions.append(nq)
                existing_q_texts.add(nq["question"])

    # Convert dict back to list
    final_data = list(new_chapters_dict.values())
    
    # Update chapter numbers
    for i, ch in enumerate(final_data):
        ch["chapter_num"] = i + 1

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2)
    
    print(f"Successfully migrated {file_name}. Reduced from {len(data)} to {len(final_data)} chapters.")

if __name__ == "__main__":
    for file_name in FILES.values():
        if file_name == "general_awareness.json":
            print("Skipping general_awareness.json as per instructions.")
            continue
        migrate_file(file_name)
