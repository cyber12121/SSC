import { Question } from '../types';

export function detectTopic(q: Question, subject: string): string {
  if (q.tags?.topic && q.tags.topic !== 'General' && q.tags.topic !== 'Unknown') {
    return q.tags.topic;
  }

  const s = (q.question + ' ' + (q.solution || '')).toLowerCase();
  const sub = (subject || '').toLowerCase();

  if (sub.includes('math') || sub.includes('quant') || sub.includes('aptitude')) {
    if (/\b(bar graph|pie chart|table shows|histogram|line graph|data interpretation)\b/i.test(s)) return 'Data Interpretation';
    if (/\b(height and distance|angle of elevation|angle of depression)\b/i.test(s)) return 'Height & Distance';
    if (/\b(sin|cos|tan|cot|sec|cosec|trigonometr)\b/i.test(s)) return 'Trigonometry';
    if (/\b(coordinate|collinear|slope of|abscissa|ordinate|equation of line|line intersects)\b/i.test(s)) return 'Coordinate Geometry';
    if (/\b(triangle|circle|chord|tangent|rhombus|parallelogram|trapezium|centroid|orthocenter|circumcenter|incenter|secant)\b/i.test(s)) return 'Geometry';
    if (/\b(cone|cylinder|sphere|hemisphere|cuboid|cube|frustum|surface area|volume of)\b/i.test(s)) return 'Mensuration 3D';
    if (/\b(area of triangle|area of circle|perimeter|semi-circle|sector|quadrilateral area|area of a rhombus|area of rectangle)\b/i.test(s)) return 'Mensuration 2D';
    if (/\b(probability|sample space|dice is rolled|cards are drawn|coin is tossed)\b/i.test(s)) return 'Probability';
    if (/\b(median|mode|variance|standard deviation|frequency distribution|statistics)\b/i.test(s)) return 'Statistics';
    if (/\b(boat|motorboat|stream|downstream|upstream|still water)\b/i.test(s)) return 'Boats & Streams';
    if (/\b(train|platform|passes a pole|crosses a bridge|length of the train)\b/i.test(s)) return 'Trains';
    if (/\b(speed|km\/h|relative speed|circular race|\brace\b|distance of \d+|km in \d+ hours|car travels|thief was spotted by a policeman|policeman started the chase)\b/i.test(s)) return 'Time, Speed & Distance';
    if (/\b(pipes?|cistern|emptying|filling tap|leak in a tank)\b/i.test(s)) return 'Pipes & Cisterns';
    if (/\b(work|worker|efficiency|alternate days?|days to complete|men and \d+ women can do a work)\b/i.test(s)) return 'Time & Work';
    if (/\b(mixture|alligation|mixes|vessel has milk to water|replaced by water|types of flour|alloy|milk to water ratio equal to)\b/i.test(s)) return 'Mixture & Alligation';
    if (/\b(partnership|invested in a business|business together|share of profit after|ratio of their investment|withdraw half his capital|three friends a, b, c invested)\b/i.test(s)) return 'Partnership';
    if (/\b(compound interest|compounded|compounded annually|compounded half-yearly|compounded 8-monthly)\b/i.test(s)) return 'Compound Interest';
    if (/\b(simple interest|per annum is ₹|sum becomes \d+ times|invested at \d+% per annum)\b/i.test(s)) return 'Simple Interest';
    if (/\b(marked price|cost price|selling price|discount|gain percentage|loss percentage|profit percentage|loss of|marked at|sold at rs|loss%)\b/i.test(s)) return 'Profit, Loss & Discount';
    if (/\b(average|mean of|average score|average age|average salary|average weight|average of 5 results|average of a number)\b/i.test(s)) return 'Average';
    if (/\b(ratio|proportion|fourth proportional|mean proportional|third proportional|ratio of the number of|ratio equal to|divided among \d+|numbers are in the ratio|a : b =|ratio of their ages|2\/7 of the students are girls)\b/i.test(s)) return 'Ratio & Proportion';
    if (/\b(percent|percentage|increased by \d+%|decreased by \d+%|\d+% of|marks and failed by|pass percentage|falls short by \d+ marks to pass|population of a city is increased|population decreases by|gives 7 parts .* what percentage)\b/i.test(s)) return 'Percentage';
    if (/\b(hcf|lcm|highest common factor|least common multiple)\b/i.test(s)) return 'LCM & HCF';
    if (/\b(simplify|simplification|value of \(\d+|\b(bodmas)\b)\b/i.test(s)) return 'Simplification';
    if (/\b(divisible|remainder|prime number|unit digit|reciprocal|sum of two numbers is \d+ and their product)\b/i.test(s)) return 'Number System';
    if (/\b(x\s*[\+\-\*\/]|polynomial|quadratic|x\^2|a\^3|b\^3|linear equation|identity|equation x\s*\/)\b/i.test(s)) return 'Algebra';
    return 'Number System';
  }

  if (sub.includes('reason')) {
    if (/\b(dice|cube|opposite to the face|positions of the same dice)\b/i.test(s)) return 'Cube & Dice';
    if (/\b(interchange the signs|interchange the two signs|correct equation|mathematical operator|operator.*means|which two numbers should be interchanged|which of the two digits should be interchanged)\b/i.test(s)) return 'Mathematical Operations';
    if (/\b(in a row of|row of children|how many children are there in that row|ranks? \d+|from the left end|from the right end|from the top|from the bottom|ranking|order and ranking)\b/i.test(s)) return 'Ranking & Order';
    if (/\b(walks? \d+|turns? left|turns? right|walked \d+|towards north|towards south|towards east|towards west|shortest distance between .* starting)\b/i.test(s)) return 'Direction & Distance';
    if (/\b(mirror image)\b/i.test(s)) return 'Mirror Image';
    if (/\b(water image)\b/i.test(s)) return 'Water Image';
    if (/\b(paper is folded|paper folding|unfolded|cutting)\b/i.test(s)) return 'Paper Folding & Cutting';
    if (/\b(embedded|hidden figure)\b/i.test(s)) return 'Embedded Figure';
    if (/\b(incomplete figure|figure completion|complete the given figure|pattern figure)\b/i.test(s)) return 'Figure Completion';
    if (/\b(number of triangles|number of squares|counting of figures|figure counting|how many triangles)\b/i.test(s)) return 'Figure Counting';
    if (/\b(clock|calendar|day of the week|leap year)\b/i.test(s)) return 'Clock & Calendar';
    if (/\b(circular table|facing the center|linear row|seating arrangement)\b/i.test(s)) return 'Seating Arrangement';
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|photograph|blood relation)\b/i.test(s)) return 'Blood Relations';
    if (/\b(statements?:|conclusions?:|all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is|syllogism)\b/i.test(s)) return 'Syllogism';
    if (/\b(statement and assumption|assumption)\b/i.test(s)) return 'Statement & Assumption';
    if (/\b(statement and conclusion)\b/i.test(s)) return 'Statement & Conclusion';
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return 'Venn Diagram';
    if (/\b(odd one out|three of the following|four words have been given of which three are alike|does not belong|classification)\b/i.test(s)) return 'Classification / Odd One Out';
    if (/\b(replace the question mark|number series|letter series|breaks the pattern|pattern|number sequence|number symbol series|letter, number, symbol series|\d+,\s*\d+,\s*\d+|cluster of five integers|pairs of numbers are there in|pairs of letters are there in|sequentially placed in the blanks of the given series)\b/i.test(s)) return 'Series';
    if (/\b(coded as|code language|coding-decoding)\b/i.test(s)) return 'Coding-Decoding';
    if (/\b(related to the third|in the same way as|analogy|related in the same)\b/i.test(s)) return 'Analogy';
    if (/\b(missing number|matrix)\b/i.test(s)) return 'Missing Number';
    if (/\b(puzzle)\b/i.test(s)) return 'Puzzle';
    return 'General Reasoning';
  }

  if (sub.includes('eng')) {
    if (/\b(correctly spelt|incorrectly spelt|misspelt|spelling|spelled|spelt)\b/i.test(s)) return 'Spelling Errors';
    if (/\b(indirect speech|direct speech|reported speech|narration)\b/i.test(s)) return 'Direct & Indirect Speech';
    if (/\b(passive voice|active voice)\b/i.test(s)) return 'Active & Passive Voice';
    if (/\b(one word substitution|one-word substitute|one word substitute|group of words)\b/i.test(s)) return 'One Word Substitution';
    if (/\b([P-S]{4}|jumbled|para jumbles?|arrange the sentences|order of the parts|order to form a meaningful)\b/i.test(s)) return 'Para Jumbles';
    if (/\b(substitute|substitution|underline|improve|sentence improvement)\b/i.test(s)) return 'Sentence Improvement';
    if (/\b(synonym|antonym|similar|opposite in meaning|homonym)\b/i.test(s)) return 'Synonyms & Antonyms';
    if (/\b(idiom|phrase)\b/i.test(s)) return 'Idioms & Phrases';
    if (/\b(fill in the blank|blank)\b/i.test(s)) return 'Fill in the Blanks';
    if (/\b(subject-verb agreement|subject verb agreement)\b/i.test(s)) return 'Subject-Verb Agreement';
    if (/\b(preposition|prepositions)\b/i.test(s)) return 'Prepositions';
    if (/\b(article|articles)\b/i.test(s)) return 'Articles';
    if (/\b(conjunction|conjunctions)\b/i.test(s)) return 'Conjunctions';
    if (/\b(pronoun|pronouns)\b/i.test(s)) return 'Pronouns';
    if (/\b(tenses|sequence of tenses)\b/i.test(s)) return 'Tenses';
    if (/\b(grammatical error|spot the error|contains an error|spotting error|grammatically correct)\b/i.test(s)) return 'Spotting Errors';
    if (/\b(cloze|passage|reading comprehension)\b/i.test(s)) return 'Cloze Test';
    return 'Spotting Errors';
  }

  if (sub.includes('aware') || sub.includes('gk') || sub.includes('gs')) {
    if (/\b(dynasty|mughal|maurya|gupta|delhi sultanate|harappan|indus|british|viceroy|gandhi|battle|buddhism|jainism|history)\b/i.test(s)) return 'History';
    if (/\b(constitution|article \d+|fundamental rights|president|prime minister|parliament|lok sabha|rajya sabha|supreme court|amendment|panchayat|polity)\b/i.test(s)) return 'Polity';
    if (/\b(river|mountain|himalaya|plateau|soil|climate|monsoon|national park|ocean|strait|geography)\b/i.test(s)) return 'Geography';
    if (/\b(gdp|inflation|rbi|monetary policy|repo rate|fiscal|budget|banking|economics)\b/i.test(s)) return 'Economics';
    if (/\b(cell|photosynthesis|newton|acid|base|chemical|velocity|force|hormone|enzyme|vitamin|disease|element|atom|science)\b/i.test(s)) return 'General Science';
    if (/\b(dance|classical dance|folk dance|festival|award|nobel|bharat ratna|temple|monument|author|stadium|static gk)\b/i.test(s)) return 'Static GK';
    return 'Static GK';
  }

  return 'General';
}
