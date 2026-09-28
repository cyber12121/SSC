import os, sys, json, re, pypdf

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r'd:\My-Project\CGL-APP\grammar_chapters_pdf\01_Noun.pdf'
reader = pypdf.PdfReader(pdf_path)

full_text = ''
for i, page in enumerate(reader.pages):
    full_text += f'\n=== PAGE {i+1} ===\n' + page.extract_text()

# Extract Questions
q_regex = re.compile(r'Q\.(\d+)\.\s*(.*?)(?=(?:Q\.\d+\.)|(?:Answers With Explanation)|(?:Sol\.\d+\.)|\Z)', re.DOTALL)
q_dict = {}
def normalize_text(text):
    if not text:
        return ''
    # Ligatures
    text = text.replace('\ufb00', 'ff')
    text = text.replace('\ufb01', 'fi')
    text = text.replace('\ufb02', 'fl')
    text = text.replace('\ufb03', 'ffi')
    text = text.replace('\ufb04', 'ffl')
    # Curly quotes
    text = text.replace('“', '"').replace('”', '"')
    text = text.replace('‘', "'").replace('’', "'")
    # Clean spacing around slashes and parts
    text = re.sub(r'\s*/\s*', ' / ', text)
    text = re.sub(r'/\s*\(([a-d])\)', r'/ (\1)', text)
    return ' '.join(text.split())

for match in q_regex.finditer(full_text):
    q_num = int(match.group(1))
    q_raw = match.group(2).strip()
    q_clean = re.sub(r'Pinnacle\s+Noun', '', q_raw)
    q_clean = re.sub(r'search on TG-@\S+', '', q_clean)
    q_clean = re.sub(r'TG-@\S+', '', q_clean)
    q_clean = re.sub(r'www\.ssccglpinnacle\.com.*', '', q_clean)
    q_clean = re.sub(r'Download Pinnacle Exam Preparation App', '', q_clean)
    q_clean = normalize_text(q_clean)
    if q_num not in q_dict and q_num <= 120:
        q_dict[q_num] = q_clean

# Extract Solutions
sol_regex = re.compile(r'Sol\.(\d+)\s*\.?\s*\(([a-d])\)\s*(.*?)(?=(?:Sol\.\d+\.)|\Z)', re.DOTALL)
sol_dict = {}
for match in sol_regex.finditer(full_text):
    sol_num = int(match.group(1))
    sol_opt = match.group(2).lower()
    sol_text = match.group(3).strip()
    sol_clean = re.sub(r'Pinnacle\s+Noun', '', sol_text)
    sol_clean = re.sub(r'search on TG-@\S+', '', sol_clean)
    sol_clean = re.sub(r'TG-@\S+', '', sol_clean)
    sol_clean = re.sub(r'www\.ssccglpinnacle\.com.*', '', sol_clean)
    sol_clean = re.sub(r'Download Pinnacle Exam Preparation App', '', sol_clean)
    sol_clean = normalize_text(sol_clean)
    if sol_num not in sol_dict and sol_num <= 120:
        sol_dict[sol_num] = {'option': sol_opt, 'explanation': sol_clean}

print(f'Parsed {len(q_dict)} questions, {len(sol_dict)} solutions.')

def split_parts(q_text):
    m = re.search(r'\(a\)(.*?)\(?\s*/?\s*\(b\)(.*?)\(?\s*/?\s*\(c\)(.*?)\(?\s*/?\s*\(d\)(.*)', q_text, re.IGNORECASE)
    if m:
        return {
            'a': m.group(1).strip().strip('/'),
            'b': m.group(2).strip().strip('/'),
            'c': m.group(3).strip().strip('/'),
            'd': m.group(4).strip().strip('/').strip('.')
        }
    return {'a': 'Part (a)', 'b': 'Part (b)', 'c': 'Part (c)', 'd': 'No error'}

questions_data = []
for i in range(1, 121):
    q_str = q_dict.get(i, '')
    parts = split_parts(q_str)
    sol_info = sol_dict.get(i, {'option': 'd', 'explanation': 'No error.'})
    
    correction = ''
    corr_match = re.search(r'(Replace\s+.*?with\s+.*?\.)', sol_info['explanation'], re.IGNORECASE)
    if corr_match:
        correction = corr_match.group(1)

    questions_data.append({
        'q_num': i,
        'type': 'spot_the_error',
        'question': q_str,
        'options': {
            'a': f"(a) {parts['a']}",
            'b': f"(b) {parts['b']}",
            'c': f"(c) {parts['c']}",
            'd': f"(d) {parts['d']}"
        },
        'answer': sol_info['option'],
        'correction': correction,
        'solution': sol_info['explanation']
    })

# Rules Data for Cheat Sheet
rules = [
    {
        "rule_num": 1,
        "title": "Always Plural Nouns (Take Plural Verb)",
        "formula": "Noun (Always Plural Form) + Plural Verb",
        "description": "These nouns are always used in the plural form only and cannot be made singular by removing 's'/'es'. They always take a plural verb.",
        "categories": {
            "Instruments / Tools": ["Scissors", "Tongs", "Pliers", "Pincers", "Bellows"],
            "Clothing / Accessories": ["Trousers", "Pants", "Pajamas", "Shorts", "Spectacles", "Glasses", "Goggles", "Binoculars", "Sunglasses"],
            "Other Common SSC Nouns": ["Alms", "Amends", "Archives", "Arrears", "Auspices", "Congratulations", "Embers", "Fireworks", "Lodgings", "Outskirts", "Particulars", "Proceeds", "Regards", "Remains", "Savings", "Shambles", "Surroundings", "Tidings", "Troops", "Tactics", "Thanks", "Valuables", "Wages", "Belongings"]
        },
        "ssc_traps": [
            {"incorrect": "Where is my scissors?", "correct": "Where are my scissors?"},
            {"incorrect": "All his belongings was lost.", "correct": "All his belongings were lost."},
            {"incorrect": "I bought a spectacles.", "correct": "I bought a pair of spectacles."}
        ],
        "key_note": "To indicate singular count, use 'a pair of...'. When 'a pair of' is used as the subject, the verb becomes singular ('A pair of trousers was bought')."
    },
    {
        "rule_num": 2,
        "title": "Plural in Form, but Singular in Meaning (Take Singular Verb)",
        "formula": "Plural-looking Noun + Singular Verb",
        "description": "These nouns end in 's' and look plural, but their meaning is singular and they always take a singular verb.",
        "categories": {
            "Subjects / Branches of Study": ["Mathematics", "Physics", "Ethics", "Economics", "Classics", "Politics", "Statistics", "Linguistics"],
            "Diseases": ["Measles", "Mumps", "Rickets", "Shingles"],
            "Games / Sports": ["Billiards", "Darts", "Draughts", "Athletics"],
            "General": ["News", "Innings", "Summons", "Gallows"]
        },
        "ssc_traps": [
            {"incorrect": "Mathematics are a difficult subject.", "correct": "Mathematics is a difficult subject."},
            {"incorrect": "No news are good news.", "correct": "No news is good news."},
            {"incorrect": "He was issued a summon.", "correct": "He was issued a summons (Singular = summons; Plural = summonses)."}
        ],
        "special_exception": "When subjects like Mathematics, Politics, Statistics are preceded by a possessive adjective (my, his, our) or 'the' to mean calculations, political views, or data, they take a PLURAL verb: 'His mathematics are very weak', 'The statistics of the survey reveal...'"
    },
    {
        "rule_num": 3,
        "title": "Singular in Form, but Always Plural in Meaning (Take Plural Verb)",
        "formula": "Noun (No -s ending) + Plural Verb",
        "description": "These nouns look singular because they lack an 's' ending, but they are plural in sense and always take a plural verb. Never add '-s' or '-es' to them.",
        "words": ["Cattle", "Cavalry", "Infantry", "Poultry", "Peasantry", "Children", "Gentry", "Police", "People", "Folk", "Company"],
        "ssc_traps": [
            {"incorrect": "Cattles are grazing in the field.", "correct": "Cattle are grazing in the field (Never say 'cattles')."},
            {"incorrect": "Police has caught the thief.", "correct": "Police have caught the thief."},
            {"incorrect": "Our infantry has marched forward.", "correct": "Our infantry have marched forward."}
        ],
        "special_exception": "'People' means human beings. 'Peoples' is used ONLY when referring to nations/ethnic groups of the world."
    },
    {
        "rule_num": 4,
        "title": "Uncountable Nouns (Always Singular Verb, No a/an, No -s/-es)",
        "formula": "Uncountable Noun + Singular Verb [Never take a/an, never take -s/-es]",
        "description": "These nouns are strictly uncountable. They cannot be pluralized by adding 's' and never take indefinite articles (a/an) directly.",
        "words": [
            "Scenery", "Poetry", "Furniture", "Advice", "Information", "Luggage", "Baggage", 
            "Postage", "Knowledge", "Jewelry", "Work", "Equipment", "Bread", "Cutlery", 
            "Confectionery", "Crockery", "Alphabet", "Percentage", "Dirt", "Dust", 
            "Traffic", "Electricity", "Money", "Music", "Garbage", "Cost", "Fuel", "Paper"
        ],
        "ssc_traps": [
            {"incorrect": "The sceneries of Kashmir are beautiful.", "correct": "The scenery of Kashmir is beautiful."},
            {"incorrect": "He gave me an advice.", "correct": "He gave me a piece of advice."},
            {"incorrect": "I have many works to do.", "correct": "I have much work to do (or: many pieces of work)."},
            {"incorrect": "Furnitures were sold.", "correct": "Furniture was sold."}
        ],
        "countability_modifiers": "To express count, use: 'a piece of advice', 'two pieces of information', 'an article of luggage', 'a loaf of bread'."
    },
    {
        "rule_num": 5,
        "title": "Usage of 'Hair' (Uncountable vs Countable)",
        "formula": "All hair on head = Uncountable (Singular) | Individual strands = Countable (Plural)",
        "description": "Hair is normally considered an uncountable collective noun taking a singular verb. However, when counting specific individual strands, it can be pluralized.",
        "ssc_traps": [
            {"incorrect": "His hairs are black.", "correct": "His hair is black."},
            {"incorrect": "She found two hair in the soup.", "correct": "She found two hairs in the soup (Countable strands)."}
        ]
    },
    {
        "rule_num": 6,
        "title": "Nouns with Identical Singular & Plural Forms",
        "formula": "Same Spelling for 1 or Many (Verb depends on context)",
        "description": "These nouns do not change form in the plural. Their verb is determined by whether the context refers to one or many.",
        "words": ["Deer", "Sheep", "Fish", "Offspring", "Aircraft", "Spacecraft", "Series", "Species", "Jury", "Team", "Crew", "Family", "Council"],
        "ssc_traps": [
            {"incorrect": "A sheep is grazing / Sheeps are grazing.", "correct": "A sheep is grazing / Sheep are grazing (Never 'sheeps')."},
            {"incorrect": "Many deers were seen.", "correct": "Many deer were seen (Never 'deers')."},
            {"incorrect": "A new series are launched.", "correct": "A new series is launched / Two new series are launched."}
        ],
        "special_exception": "'Fishes' is only used when referring to different species or varieties of fish, not total quantity."
    },
    {
        "rule_num": 7,
        "title": "[The + Common Noun] Expressing an Abstract Quality",
        "formula": "'The' + Common Noun = Abstract Quality / Feeling",
        "description": "When 'the' is prefixed to a common noun representing a person or relation, it denotes the inner emotion, instinct, or characteristic (functioning as an abstract noun).",
        "examples": [
            {"sentence": "The judge in him prevailed over the father.", "explanation": "'The judge' = sense of justice; 'the father' = fatherly affection."},
            {"sentence": "The mother in her arose when she saw the crying orphan.", "explanation": "'The mother' = maternal instinct."}
        ]
    },
    {
        "rule_num": 8,
        "title": "Plural of Nouns Ending in '-ful'",
        "formula": "Base + ful + 's' -> (cupfuls, handfuls)",
        "description": "Nouns ending in 'ful' are pluralized by adding 's' at the very end of 'ful', NOT to the base noun.",
        "words": ["Cupfuls", "Handfuls", "Glassfuls", "Spoonfuls", "Mouthfuls", "Bucketfuls"],
        "ssc_traps": [
            {"incorrect": "He drank three cupsful of coffee.", "correct": "He drank three cupfuls of coffee."},
            {"incorrect": "Take two spoonsful of syrup.", "correct": "Take two spoonfuls of syrup."}
        ]
    },
    {
        "rule_num": 9,
        "title": "Precise Usage of 'Half'",
        "formula": "Half an hour / A half-hour | Two and a half hours / Two hours and a half",
        "description": "Specific structural conventions govern how 'half' pairs with time and units:",
        "rules": [
            "• 'Half an hour' OR 'A half-hour' (NOT 'A half an hour')",
            "• 'A half mile' OR 'Half a mile'",
            "• 'One and a half hours' (Plural unit)",
            "• 'Two and a half hours' OR 'Two hours and a half'"
        ],
        "ssc_traps": [
            {"incorrect": "I waited for a half an hour.", "correct": "I waited for half an hour (or a half-hour)."}
        ]
    },
    {
        "rule_num": 10,
        "title": "Hyphenated Compound Nouns Used as Adjectives",
        "formula": "Numeral + Hyphen + Singular Noun (Never Pluralized)",
        "description": "When a compound noun with a numeral functions as an adjective before another noun, the hyphenated noun must ALWAYS be singular.",
        "examples": [
            {"incorrect": "A ten-rupees note", "correct": "A ten-rupee note"},
            {"incorrect": "A five-stars hotel", "correct": "A five-star hotel"},
            {"incorrect": "A three-days workshop", "correct": "A three-day workshop"},
            {"incorrect": "A two-miles walk", "correct": "A two-mile walk"}
        ],
        "key_note": "If not modifying another noun, the noun is plural: 'He gave me ten rupees'."
    },
    {
        "rule_num": 11,
        "title": "Definite vs Indefinite Counting Nouns (Dozen, Hundred, Thousand...)",
        "formula": "Definite Number + Dozen/Hundred/Million + Noun (Singular) | Dozens/Hundreds + of + Noun (Plural)",
        "description": "Words like dozen, score, hundred, thousand, million, billion remain SINGULAR when preceded by an exact number. They take '-s' and 'of' only when indefinite.",
        "ssc_traps": [
            {"incorrect": "I bought two dozens bananas.", "correct": "I bought two dozen bananas."},
            {"incorrect": "Three thousands people attended.", "correct": "Three thousand people attended."},
            {"correct_indefinite": "Dozens of bananas were spoiled / Thousands of people attended."}
        ]
    },
    {
        "rule_num": 12,
        "title": "'The + Adjective' Representing a Whole Class",
        "formula": "'The' + Adjective = Plural Common Noun + Plural Verb",
        "description": "When 'the' is placed before adjectives like poor, rich, blind, deaf, educated, sick, it denotes all people in that category. It acts as a plural noun and takes a plural verb. Never add '-s' to the adjective.",
        "ssc_traps": [
            {"incorrect": "The poors are honest.", "correct": "The poor are honest (Never say 'the poors')."},
            {"incorrect": "The rich exploits the poor.", "correct": "The rich exploit the poor."}
        ]
    },
    {
        "rule_num": 13,
        "title": "'The + Plural Surname' Denoting the Whole Family",
        "formula": "'The' + Surname-s + Plural Verb",
        "description": "Preceding a pluralized family name with 'The' refers to the entire family as a group, requiring a plural verb.",
        "examples": [
            {"sentence": "The Sharmas have gone on vacation.", "explanation": "Refers to the entire Sharma family."},
            {"sentence": "The Guptas are our neighbors.", "explanation": "Refers to all members of the Gupta family."}
        ]
    },
    {
        "rule_num": 14,
        "title": "Frequent Superfluous / Slang Noun Errors in SSC",
        "description": "Expressions common in colloquial Indian English that are strictly incorrect in Standard English:",
        "pairs": [
            {"incorrect": "What is your good name?", "correct": "What is your name?"},
            {"incorrect": "He is my cousin brother / cousin sister.", "correct": "He is my cousin / She is my cousin."},
            {"incorrect": "He secured passing marks.", "correct": "He secured pass marks."},
            {"incorrect": "Take linking road.", "correct": "Take link road."},
            {"incorrect": "A pickpocketer stole my wallet.", "correct": "A pickpocket stole my wallet."},
            {"incorrect": "Boarding / Lodging", "correct": "Boarding house / Lodging house"}
        ]
    },
    {
        "rule_num": 15,
        "title": "Repeated Nouns Connected by a Preposition",
        "formula": "Singular Noun + Preposition + Same Singular Noun + Singular Verb",
        "description": "When the same noun is repeated on either side of a preposition, both nouns MUST be in singular form, and the verb MUST be singular.",
        "ssc_traps": [
            {"incorrect": "Pages after pages were read.", "correct": "Page after page was read."},
            {"incorrect": "Doors to doors were visited.", "correct": "Door to door was visited."},
            {"incorrect": "Rows upon rows of marble looks beautiful.", "correct": "Row upon row of marble looks beautiful."}
        ]
    },
    {
        "rule_num": 16,
        "title": "Common Gender Nouns & Default Pronoun",
        "formula": "Common Gender Noun (Teacher, Doctor, Student, Clerk, Leader) -> Default Pronoun 'He/His'",
        "description": "When the gender of a common noun is unknown or unspecified, traditional grammatical convention uses the masculine third-person pronoun (he/his/him), NOT 'it' or 'they'.",
        "examples": [
            {"sentence": "Every student must submit his assignment on time.", "note": "Use 'his', not 'their' or 'one's'."}
        ]
    },
    {
        "rule_num": 17,
        "title": "Noun Gender & Personified Gender Laws",
        "description": "Rules for masculine, feminine, and personified objects:",
        "sections": {
            "Adding '-ess' with vowel drops": "Actor → Actress, Hunter → Huntress, Waiter → Waitress, Master → Mistress",
            "Personified Masculine (Strength, Violence, Power)": ["Sun", "Summer", "Winter", "Time", "Death", "War"],
            "Personified Feminine (Beauty, Grace, Gentleness, Fertility)": ["Moon", "Earth", "Spring", "Autumn", "Nature", "Liberty", "Justice", "Mercy", "Peace", "Ship"]
        },
        "examples": [
            {"sentence": "The Sun shed his beams upon rich and poor alike.", "note": "Sun = masculine ('his')."},
            {"sentence": "The Moon hid her face behind a cloud.", "note": "Moon = feminine ('her')."}
        ]
    },
    {
        "rule_num": 18,
        "title": "High-Frequency SSC Collective Nouns",
        "groups": [
            "A pride of lions", "A shoal / school of fish", "A pack of wolves / hounds / cards",
            "A bevy of girls / ladies", "A flock of birds / sheep", "A herd of cattle / elephants",
            "An orchestra of musicians", "A litter of puppies / kittens / pigs", "A fleet of ships / motor cars",
            "A swarm of bees / flies / ants", "A bouquet of flowers", "A clump / grove of trees",
            "A suite of rooms", "A band of musicians / robbers", "A galaxy / constellation of stars"
        ]
    },
    {
        "rule_num": 19,
        "title": "Singular to Plural Formation Traps & Compound Plurals",
        "rules": [
            "1. Nouns ending in 'o' preceded by vowel add 's' (Radio → Radios, Video → Videos, Bamboo → Bamboos).",
            "2. Compound Nouns: Pluralize the HEAD / ROOT WORD, not the tail word:",
            "   • Sister-in-law → Sisters-in-law (NOT sister-in-laws)",
            "   • Commander-in-chief → Commanders-in-chief (NOT commander-in-chiefs)",
            "   • Passer-by → Passers-by (NOT passer-bys)",
            "   • Looker-on → Lookers-on",
            "   • Maid-servant → Maid-servants",
            "   • Step-son → Step-sons",
            "   • Man-servant → Men-servants (Both words change)",
            "   • Woman-doctor → Women-doctors"
        ]
    },
    {
        "rule_num": 20,
        "title": "Foreign Origin Noun Plurals (Greek / Latin Traps)",
        "conversions": [
            {"singular": "Datum", "plural": "Data"},
            {"singular": "Criterion", "plural": "Criteria"},
            {"singular": "Phenomenon", "plural": "Phenomena"},
            {"singular": "Oasis", "plural": "Oases"},
            {"singular": "Crisis", "plural": "Crises"},
            {"singular": "Basis", "plural": "Bases"},
            {"singular": "Radius", "plural": "Radii"},
            {"singular": "Stratum", "plural": "Strata"},
            {"singular": "Formula", "plural": "Formulae / Formulas"},
            {"singular": "Bacterium", "plural": "Bacteria"},
            {"singular": "Medium", "plural": "Media"},
            {"singular": "Index", "plural": "Indices"}
        ],
        "ssc_traps": [
            {"incorrect": "All the datas were lost.", "correct": "All the data was/were lost (Never say 'datas')."},
            {"incorrect": "What is the criteria for selection?", "correct": "What is the criterion for selection? (Singular = criterion)."},
            {"incorrect": "This is a natural phenomena.", "correct": "This is a natural phenomenon (Singular = phenomenon)."}
        ]
    },
    {
        "rule_num": 21,
        "title": "Compound Nouns Always Used in Plural Form",
        "words": [
            "Current affairs", "Armed forces", "Human rights", "Social studies", 
            "High heels", "Civil rights", "Natural resources", "Public relations", "Winter sports"
        ],
        "example": "He has a keen interest in current affairs (NOT current affair)."
    },
    {
        "rule_num": 22,
        "title": "Complete Noun Meaning Shifts when Pluralized (-s)",
        "pairs": [
            {"word": "Wood", "singular_meaning": "Timber / Material", "plural": "Woods", "plural_meaning": "Forest"},
            {"word": "Good", "singular_meaning": "Benefit / Virtue", "plural": "Goods", "plural_meaning": "Merchandise / Cargo"},
            {"word": "Force", "singular_meaning": "Strength / Power", "plural": "Forces", "plural_meaning": "Armed troops"},
            {"word": "Air", "singular_meaning": "Atmospheric gas", "plural": "Airs", "plural_meaning": "Arrogant behavior / affected manners"},
            {"word": "Iron", "singular_meaning": "Metal element", "plural": "Irons", "plural_meaning": "Chains / Shackles / Fetters"},
            {"word": "Sand", "singular_meaning": "Granular material", "plural": "Sands", "plural_meaning": "Desert / Beach tract"},
            {"word": "Water", "singular_meaning": "Liquid", "plural": "Waters", "plural_meaning": "Sea / Ocean territory"},
            {"word": "Work", "singular_meaning": "Labor / Task", "plural": "Works", "plural_meaning": "Literary compositions / Factory"},
            {"word": "Damage", "singular_meaning": "Physical harm / Loss", "plural": "Damages", "plural_meaning": "Financial compensation awarded by court"},
            {"word": "Abuse", "singular_meaning": "Misuse / Bad words", "plural": "Abuses", "plural_meaning": "Social evils / corrupt practices"},
            {"word": "Arm", "singular_meaning": "Upper limb of body", "plural": "Arms", "plural_meaning": "Weapons"},
            {"word": "Physic", "singular_meaning": "Medicine", "plural": "Physics", "plural_meaning": "Branch of science"},
            {"word": "Premise", "singular_meaning": "Proposition in logic", "plural": "Premises", "plural_meaning": "Building / Property grounds"},
            {"word": "Spectacle", "singular_meaning": "Remarkable sight", "plural": "Spectacles", "plural_meaning": "Eyeglasses"}
        ]
    },
    {
        "rule_num": 23,
        "title": "Comprehensive Apostrophe ('s) Laws",
        "sub_rules": [
            "i) Used for Living Beings: 'Boy's book', 'Cow's milk'. For Non-Living things, NEVER use 's — use 'of': 'The leg of the table' (NOT 'table's leg'), 'The cover of the book' (NOT 'book's cover').",
            "ii) Exceptions where Non-Living CAN take 's: Personified objects ('Nature's laws', 'Fortune's favorites'), Time/Space/Weight ('A day's leave', 'A mile's distance', 'A pound's weight'), Dignified celestial bodies ('The earth's surface', 'The sun's rays'), and established Idioms ('At one's wit's end', 'At an arm's length', 'At a stone's throw').",
            "iii) Nouns ending in 's' or hissing sound: Only add the apostrophe (') without 's': 'Keats' poems', 'Dickens' novels', 'For conscience' sake', 'For peace' sake', 'Boys' school'.",
            "iv) Joint Possession vs Separate Possession: If two nouns possess something jointly, add 's to the second noun only ('Ram and Shyam's father'). If they possess different items, add 's to both ('Ram's and Shyam's fathers').",
            "v) Compound Nouns: Apostrophe is added to the LAST word only: 'Father-in-law's house', 'Commander-in-chief's order' (NOT 'Father's-in-law').",
            "vi) Pronouns that NEVER take an Apostrophe: Possessive pronouns (hers, ours, yours, theirs, its, whose) NEVER take an apostrophe. 'Yours faithfully' (NOT 'Your's faithfully'). 'Its color' (possessive) vs 'It's' (= It is).",
            "vii) 'Else' following Indefinite Pronouns: When 'else' follows somebody, anybody, nobody, someone, anyone, put the apostrophe on 'else': 'Somebody else's book' (NOT 'Somebody's else')."
        ]
    }
]

chapter_payload = {
    "chapter_num": 1,
    "chapter_id": "01_noun",
    "chapter_title": "Noun",
    "subject": "English",
    "subject_id": "english",
    "section": "grammar",
    "topic_name": "noun",
    "total_rules": 23,
    "total_questions": len(questions_data),
    "cheat_sheet": {
        "title": "Noun Complete Revision Cheat Sheet",
        "subtitle": "All 23 Core Rules, Golden Formulas, Complete Word Lists & Exam Traps",
        "rules": rules
    },
    "questions": questions_data
}

dest_json = r'd:\My-Project\CGL-APP\src\data\chapter_bank\english\grammar\01_noun.json'
with open(dest_json, 'w', encoding='utf-8') as f:
    json.dump(chapter_payload, f, indent=2, ensure_ascii=False)

print(f'Successfully wrote {dest_json} with {len(questions_data)} questions and {len(rules)} rules.')

# Also generate a crisp, gorgeous Markdown Cheat Sheet
md_lines = [
    "# 📘 Chapter 01: Noun — Complete Revision Cheat Sheet",
    "> **Source:** Pinnacle 60 Days English Grammar Mastery  ",
    f"> **Coverage:** All {len(rules)} Rules • Complete Word Lists • SSC Exam Traps • {len(questions_data)} Practice Questions",
    "",
    "---",
    ""
]

for r in rules:
    md_lines.append(f"## ⚡ Rule {r['rule_num']}: {r['title']}")
    if 'formula' in r:
        md_lines.append(f"**Formula / Structure:** `{r['formula']}`\n")
    if 'description' in r:
        md_lines.append(f"{r['description']}\n")
    
    if 'categories' in r:
        for cat, wds in r['categories'].items():
            md_lines.append(f"- **{cat}:** {', '.join(wds)}")
        md_lines.append("")
        
    if 'words' in r:
        md_lines.append(f"- **Complete Word List:** {', '.join(r['words'])}\n")
        
    if 'sub_rules' in r:
        for sr in r['sub_rules']:
            md_lines.append(f"- {sr}")
        md_lines.append("")

    if 'groups' in r:
        md_lines.append(f"- **High-Frequency Collectives:** {', '.join(r['groups'])}\n")

    if 'rules' in r:
        for ru in r['rules']:
            md_lines.append(f"- {ru}")
        md_lines.append("")

    if 'sections' in r:
        for sec_title, sec_val in r['sections'].items():
            if isinstance(sec_val, list):
                md_lines.append(f"- **{sec_title}:** {', '.join(sec_val)}")
            else:
                md_lines.append(f"- **{sec_title}:** {sec_val}")
        md_lines.append("")

    if 'examples' in r:
        for ex in r['examples']:
            if 'sentence' in ex:
                md_lines.append(f"- **Example:** *{ex['sentence']}* ({ex.get('explanation', ex.get('note', ''))})")
        md_lines.append("")
        
    if 'conversions' in r:
        md_lines.append("| Singular Form | Plural Form |")
        md_lines.append("| :--- | :--- |")
        for conv in r['conversions']:
            md_lines.append(f"| {conv['singular']} | **{conv['plural']}** |")
        md_lines.append("")
        
    if 'pairs' in r and r.get('rule_num') == 22:
        md_lines.append("| Singular Word | Meaning | Plural Word | Meaning Shifts To |")
        md_lines.append("| :--- | :--- | :--- | :--- |")
        for p in r['pairs']:
            md_lines.append(f"| **{p['word']}** | {p['singular_meaning']} | **{p['plural']}** | {p['plural_meaning']} |")
        md_lines.append("")

    if 'pairs' in r and r.get('rule_num') == 14:
        md_lines.append("| Incorrect Colloquial Usage ❌ | Correct Standard English ✔️ |")
        md_lines.append("| :--- | :--- |")
        for p in r['pairs']:
            md_lines.append(f"| {p['incorrect']} | **{p['correct']}** |")
        md_lines.append("")

    if 'ssc_traps' in r:
        md_lines.append("**⚠️ SSC Exam Traps (Spot the Error):**")
        for t in r['ssc_traps']:
            if 'incorrect' in t and 'correct' in t:
                md_lines.append(f"- ❌ *{t['incorrect']}*  ")
                md_lines.append(f"  ✔️ **{t['correct']}**")
        md_lines.append("")
        
    if 'key_note' in r:
        md_lines.append(f"> 💡 **Key SSC Note:** {r['key_note']}\n")
    if 'special_exception' in r:
        md_lines.append(f"> ⚠️ **Special Exception:** {r['special_exception']}\n")
        
    md_lines.append("---\n")

dest_md = r'd:\My-Project\CGL-APP\src\data\chapter_bank\english\grammar\01_noun_cheatsheet.md'
with open(dest_md, 'w', encoding='utf-8') as f:
    f.write('\n'.join(md_lines))

print(f'Successfully wrote {dest_md}.')
