import { Question } from '../types';

export function detectTopic(q: Question, subject: string): string {
  if (q.tags?.topic && q.tags.topic !== 'General' && q.tags.topic !== 'Unknown') {
    return q.tags.topic;
  }

  const s = (q.question + ' ' + (q.solution || '')).toLowerCase();
  const sub = (subject || '').toLowerCase();

  if (sub.includes('math') || sub.includes('quant') || sub.includes('aptitude')) {
    if (/\b(sin|cos|tan|cot|sec|cosec|trigonometr|height and distance)\b/i.test(s)) return 'Trigonometry';
    if (/\b(triangle|circle|chord|tangent|rhombus|parallelogram|trapezium|centroid|orthocenter|circumcenter|geometry)\b/i.test(s)) return 'Geometry';
    if (/\b(polynomial|quadratic|x\^|a\^3|b\^3|linear equation|algebra|identity)\b/i.test(s)) return 'Algebra';
    if (/\b(cone|cylinder|sphere|hemisphere|cuboid|cube|frustum|surface area|volume of|mensuration)\b/i.test(s)) return 'Mensuration';
    if (/\b(work|pipes?|cistern|efficiency|alternate days?)\b/i.test(s)) return 'Time & Work';
    if (/\b(train|speed|downstream|upstream|boat|km\/h|relative speed|race|distance)\b/i.test(s)) return 'Time, Speed & Distance';
    if (/\b(compound interest|simple interest|compounded|per annum|ci|si)\b/i.test(s)) return 'Simple & Compound Interest';
    if (/\b(marked price|cost price|selling price|discount|gain percentage|loss percentage|profit)\b/i.test(s)) return 'Profit & Loss';
    if (/\b(percent|percentage|increased by|decreased by)\b/i.test(s)) return 'Percentage';
    if (/\b(ratio|proportion|fourth proportional|mean proportional)\b/i.test(s)) return 'Ratio & Proportion';
    if (/\b(average|mean of|average score|average age)\b/i.test(s)) return 'Average';
    if (/\b(divisible|remainder|hcf|lcm|prime number|unit digit|number system)\b/i.test(s)) return 'Number System';
    if (/\b(bar graph|pie chart|table shows|histogram|line graph|data interpretation)\b/i.test(s)) return 'Data Interpretation';
    return 'Arithmetic & Advanced';
  }

  if (sub.includes('reason')) {
    if (/\b(statements?:|conclusions?:|all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is|syllogism)\b/i.test(s)) return 'Syllogism';
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|blood relations?)\b/i.test(s)) return 'Blood Relations';
    if (/\b(walks? \d+|turns? left|turns? right|north|south|east|west|direction)\b/i.test(s)) return 'Direction & Distance';
    if (/\b(coded as|code language|coding-decoding)\b/i.test(s)) return 'Coding-Decoding';
    if (/\b(related to the third|in the same way as|analogy)\b/i.test(s)) return 'Analogy';
    if (/\b(odd one out|three of the following|does not belong|classification)\b/i.test(s)) return 'Classification';
    if (/\b(replace the question mark|series|number series)\b/i.test(s)) return 'Number & Letter Series';
    if (/\b(interchange the signs|correct equation|mathematical operations)\b/i.test(s)) return 'Mathematical Operations';
    if (/\b(dice|cube|opposite to the face)\b/i.test(s)) return 'Dice & Cube';
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return 'Venn Diagram';
    if (/\b(circular table|facing the center|linear row|seating arrangement)\b/i.test(s)) return 'Seating Arrangement';
    return 'General Reasoning';
  }

  if (sub.includes('eng')) {
    if (/\b(grammatical error|spot the error|contains an error)\b/i.test(s)) return 'Spotting Errors';
    if (/\b(substitute|substitution|underline|improve|sentence improvement)\b/i.test(s)) return 'Sentence Improvement';
    if (/\b(fill in the blank|blank)\b/i.test(s)) return 'Fill in the Blanks';
    if (/\b(synonym|antonym|similar|opposite in meaning)\b/i.test(s)) return 'Synonyms & Antonyms';
    if (/\b(idiom|phrase)\b/i.test(s)) return 'Idioms & Phrases';
    if (/\b(one word substitution|group of words)\b/i.test(s)) return 'One Word Substitution';
    if (/\b(passive voice|active voice)\b/i.test(s)) return 'Active & Passive Voice';
    if (/\b(indirect speech|direct speech|reported speech)\b/i.test(s)) return 'Direct & Indirect Speech';
    if (/\b(correctly spelt|incorrectly spelt|misspelt|spelling)\b/i.test(s)) return 'Spelling Errors';
    if (/\b(cloze|passage|reading comprehension)\b/i.test(s)) return 'Cloze & Comprehension';
    if (/\b([P-S]{4}|jumbled|para jumbles?)\b/i.test(s)) return 'Para Jumbles';
    return 'Grammar & Vocabulary';
  }

  if (sub.includes('aware') || sub.includes('gk') || sub.includes('gs')) {
    if (/\b(dynasty|mughal|maurya|gupta|delhi sultanate|harappan|indus|british|viceroy|gandhi|battle|buddhism|jainism|history)\b/i.test(s)) return 'History';
    if (/\b(constitution|article \d+|fundamental rights|president|prime minister|parliament|lok sabha|rajya sabha|supreme court|amendment|panchayat|polity)\b/i.test(s)) return 'Indian Polity';
    if (/\b(river|mountain|himalaya|plateau|soil|climate|monsoon|national park|ocean|strait|geography)\b/i.test(s)) return 'Geography';
    if (/\b(gdp|inflation|rbi|monetary policy|repo rate|fiscal|budget|banking|economics)\b/i.test(s)) return 'Economics';
    if (/\b(cell|photosynthesis|newton|acid|base|chemical|velocity|force|hormone|enzyme|vitamin|disease|element|atom|science)\b/i.test(s)) return 'General Science';
    if (/\b(dance|classical dance|folk dance|festival|award|nobel|bharat ratna|temple|monument|author|stadium|static gk)\b/i.test(s)) return 'Static GK';
    return 'Static GK';
  }

  return 'General';
}
