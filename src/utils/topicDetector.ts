import { Question } from '../types';

export function normalizeTopicTitle(rawTopic?: string | null): string {
  if (!rawTopic) return 'General';
  const clean = rawTopic.trim();
  if (!clean || clean === 'General' || clean === 'Unknown' || clean === 'English Comprehension' || clean === 'English') return 'General';
  
  // Unify all Active & Passive Voice subtopics and variants into one chapter bucket
  if (
    /^active\s*(&|and|\/|to)?\s*passive/i.test(clean) ||
    /^passive\s*(&|and|\/|to)?\s*active/i.test(clean) ||
    /\b(active\s*(&|and|\/|to)\s*passive|passive\s*(&|and|\/|to)\s*active|passive\s*voice|active\s*voice|voice\s*change)\b/i.test(clean) ||
    /^voice\b/i.test(clean)
  ) {
    return 'Active & Passive Voice';
  }

  // Unify Direct & Indirect Speech / Narration
  if (
    /^direct\s*(&|and|\/|to)?\s*indirect/i.test(clean) ||
    /^indirect\s*(&|and|\/|to)?\s*direct/i.test(clean) ||
    /^narration/i.test(clean) ||
    /\b(direct\s*(&|and|\/|to)\s*indirect|reported\s*speech|speech\s*change)\b/i.test(clean)
  ) {
    return 'Direct & Indirect Speech';
  }

  if (/^missing\s*numbers?(\s*\/\s*matrix)?/i.test(clean) || /^matrix\b/i.test(clean)) return 'Missing Number / Matrix';
  if (/^one\s*words?(\s*substitut\w*)?/i.test(clean) || /^ows\b/i.test(clean)) return 'One Word Substitution';
  if (/^para\s*jumbles?/i.test(clean) || /^pqrs\b/i.test(clean) || /^sentence\s*rearrangement/i.test(clean)) return 'Para Jumbles';
  if (/^spelling?\s*errors?/i.test(clean) || /^misspelt/i.test(clean) || /^incorrect\s*spellings?/i.test(clean) || /^correctly\s*spelt/i.test(clean) || /^spellings?/i.test(clean)) return 'Spelling Errors';
  if (/^synonyms?\s*(&|and)?\s*antonyms?/i.test(clean) || /^syno\s*(&|and)?\s*anto/i.test(clean) || /^anto\s*(&|and)?\s*syno/i.test(clean) || /^synonyms?/i.test(clean) || /^antonyms?/i.test(clean) || /^syno$/i.test(clean) || /^anto$/i.test(clean)) return 'Synonyms & Antonyms';
  if (/^idioms?\s*(&|and)?\s*phrases?/i.test(clean)) return 'Idioms & Phrases';
  if (/^fill\s*in\s*the\s*blanks?/i.test(clean) || /^fillers?/i.test(clean)) return 'Fill in the Blanks';
  if (/^sentence\s*improvement/i.test(clean)) return 'Sentence Improvement';
  if (/^spotting?\s*errors?/i.test(clean)) return 'Spotting Errors';
  if (/^cloze\s*test/i.test(clean) || /^cloze\b/i.test(clean)) return 'Cloze Test';
  if (/^reading\s*comprehension/i.test(clean) || /^rc\b/i.test(clean) || /^comprehension/i.test(clean)) return 'Reading Comprehension';
  return clean;
}

export function detectTopic(q: Question, subject: string): string {
  const s = (q.question + ' ' + (q.solution || '')).toLowerCase();
  const sub = (subject || '').toLowerCase();
  const isReasoning = sub.includes('reason') || sub.includes('intel');

  const rawTag = q.tags?.topic || (q as any).topic;
  let currentTopic: string | undefined = rawTag ? normalizeTopicTitle(rawTag) : undefined;
  if (currentTopic === 'General' || currentTopic === 'English Comprehension' || currentTopic === 'English') currentTopic = undefined;

  // Fallback to subtopic if topic is unassigned or generic
  if (!currentTopic) {
    const rawSubtopic = q.tags?.subtopic || (q as any).subtopic;
    if (rawSubtopic) {
      const normalizedSub = normalizeTopicTitle(rawSubtopic);
      if (normalizedSub && normalizedSub !== 'General' && normalizedSub !== 'Unknown' && normalizedSub !== 'English Comprehension' && normalizedSub !== 'English') {
        currentTopic = normalizedSub;
      }
    }
  }

  // Clean obvious cross-subject or cross-topic misclassifications in Reasoning
  if (isReasoning && currentTopic) {
    if (
      currentTopic === 'Number System' ||
      currentTopic === 'Static GK' ||
      (currentTopic === 'Analogy' && /\b(given series|breaks the pattern|odd number pair|reverse alphabetical|arranged in the reverse)\b/i.test(s)) ||
      (currentTopic === 'Coding-Decoding' && /\b(interchanged|equation|pairs of letters|vowel is changed)\b/i.test(s)) ||
      (currentTopic === 'Seating Arrangement' && /\b(flagpoles|rank|corridor|how many flagpoles|from the left end and)\b/i.test(s)) ||
      (currentTopic === 'Syllogism' && !/\b(all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(s))
    ) {
      currentTopic = undefined;
    }
  }

  if (currentTopic && currentTopic !== 'General' && currentTopic !== 'Unknown') {
    return currentTopic;
  }

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

  if (isReasoning) {
    if (/\b(dice|cube|opposite to the face|positions of the same dice)\b/i.test(s)) return 'Cube & Dice';
    if (/\b(interchange the signs|interchange the two signs|correct equation|mathematical operator|operator.*means|which two numbers should be interchanged|which of the two digits should be interchanged|equations will be correct)\b/i.test(s)) return 'Mathematical Operations';
    if (/\b(in a row of|row of children|how many children are there in that row|ranks? \d+|from the left end|from the right end|from the top|from the bottom|ranking|order and ranking|flagpoles|midway between)\b/i.test(s)) return 'Order & Ranking';
    if (/\b(walks? \d+|turns? left|turns? right|walked \d+|towards north|towards south|towards east|towards west|shortest distance between .* starting|compass started giving wrong directions)\b/i.test(s)) return 'Direction & Distance';
    if (/\b(mirror image)\b/i.test(s)) return 'Mirror Image';
    if (/\b(water image)\b/i.test(s)) return 'Water Image';
    if (/\b(paper is folded|paper folding|unfolded|cutting)\b/i.test(s)) return 'Paper Folding & Cutting';
    if (/\b(embedded|hidden figure)\b/i.test(s)) return 'Embedded Figure';
    if (/\b(incomplete figure|figure completion|complete the given figure|pattern figure)\b/i.test(s)) return 'Figure Completion';
    if (/\b(number of triangles|number of squares|counting of figures|figure counting|how many triangles)\b/i.test(s)) return 'Figure Counting';
    if (/\b(clock|calendar|day of the week|leap year)\b/i.test(s)) return 'Clock & Calendar';
    if (/\b(circular table|facing the center|linear row|seating arrangement|sitting in a row|sitting second to the left)\b/i.test(s)) return 'Seating Arrangement';
    if (/\b(mother|father|brother|sister|son|daughter|uncle|aunt|nephew|niece|husband|wife|photograph|blood relation|father-in-law)\b/i.test(s)) return 'Blood Relations';
    if (/\b(all\s+\w+\s+are|some\s+\w+\s+are|no\s+\w+\s+is)\b/i.test(s)) return 'Syllogism';
    if (/\b(statement and assumption|assumption)\b/i.test(s)) return 'Statement & Assumption';
    if (/\b(statement:?|conclusions?:?|statement is given followed by a few conclusions)\b/i.test(s)) return 'Statement & Conclusion';
    if (/\b(venn diagram|represents the relationship)\b/i.test(s)) return 'Venn Diagram';
    if (/\b(odd one out|three of the following|four words have been given of which three are alike|does not belong|classification|odd number pair)\b/i.test(s)) return 'Classification / Odd One Out';
    if (/\b(pairs of letters|letter immediately succeeding|reverse alphabetical order|alphabetical order|word formation)\b/i.test(s)) return 'Alphabet Test';
    if (/\b(decimal number and smallest decimal|arithmetical reasoning)\b/i.test(s)) return 'Arithmetical Reasoning';
    if (/\b(replace the question mark|number series|breaks the pattern|pattern|number sequence|\d+,\s*\d+,\s*\d+|cluster of five integers)\b/i.test(s)) return 'Number Series';
    if (/\b(letter series|letter, number, symbol series|sequentially placed in the blanks of the given series)\b/i.test(s)) return 'Letter & Symbol Series';
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
    if (/\b([P-S]{4}|jumbled|para jumbles?|arrange the sentences|order of the parts|order to form a meaningful|sentence rearrangement)\b/i.test(s)) return 'Para Jumbles';
    if (/\b(substitute the underlined|substitute the bold|improve the underlined|improve the segment|sentence improvement)\b/i.test(s)) return 'Sentence Improvement';
    if (/\b(synonym|antonym|similar in meaning|opposite in meaning|closest in meaning|homonym)\b/i.test(s)) return 'Synonyms & Antonyms';
    if (/\b(idiom|phrase)\b/i.test(s)) return 'Idioms & Phrases';
    if (/\b(what will come in blank \(\d+\)|blank \(\d+\)|cloze test|cloze passage)\b/i.test(s)) return 'Cloze Test';
    if (/\b(according to the passage|based on the passage|author's tone|author’s tone|reading comprehension)\b/i.test(s)) return 'Reading Comprehension';
    if (/\b(fill in the blank|single filler|double filler)\b/i.test(s)) return 'Fill in the Blanks';
    if (/\b(subject-verb agreement|subject verb agreement)\b/i.test(s)) return 'Subject-Verb Agreement';
    if (/\b(preposition|prepositions)\b/i.test(s)) return 'Prepositions';
    if (/\b(article|articles)\b/i.test(s)) return 'Articles';
    if (/\b(conjunction|conjunctions)\b/i.test(s)) return 'Conjunctions';
    if (/\b(pronoun|pronouns)\b/i.test(s)) return 'Pronouns';
    if (/\b(tenses|sequence of tenses)\b/i.test(s)) return 'Tenses';
    if (/\b(grammatical error|spot the error|contains an error|spotting error|grammatically correct)\b/i.test(s)) return 'Spotting Errors';
    if (/\b(cloze)\b/i.test(s)) return 'Cloze Test';
    if (/\b(passage)\b/i.test(s)) return 'Reading Comprehension';
    if (/\b(blank)\b/i.test(s)) return 'Fill in the Blanks';
    return 'Spotting Errors';
  }

  if (sub.includes('aware') || sub.includes('gk') || sub.includes('gs')) {
    // 1. Static GK: Dance, Music, Festivals
    if (/\b(kathak|bharatanatyam|kathakali|kuchipudi|odissi|manipuri|mohiniyattam|sattriya|garba|bhangra|ghoomar|lavani|yakshagana|chhau|classical dance|folk dance)\b/i.test(s)) return 'Folk & Classical Dances';
    if (/\b(sitar|sarod|tabla|shehnai|flute|veena|santur|ghat|ghatam|sarangi|mridangam|hindustani classical music|carnatic music|raga|ragas|gharana|vocal|andolan)\b/i.test(s)) return 'Music & Musical Instruments';
    if (/\b(festival|bihu|hornbill|losar|pongal|onam|chath|pushkar mela|fair|harvest festival)\b/i.test(s)) return 'Festivals & Fairs';

    // 2. Static GK: Awards, Books, Sports
    if (/\b(sangeet natak akademi|sahitya akademi|arjuna award|khel ratna|padma vibhushan|padma bhushan|padma shri|bharat ratna|nobel prize|dadasaheb phalke|jnanpith|award|national award)\b/i.test(s)) return 'Awards & Honours';
    if (/\b(written by|author of the book|novel|autobiography|memoir|the serpent and the rope|in praise of coalition politics|author)\b/i.test(s)) return 'Books & Authors';
    if (/\b(olympic|commonwealth games|asian games|khelo india|cricket|fifa|football|badminton|tennis|hockey|trophy|cup|medal tally|motto of the 2026)\b/i.test(s)) return 'Sports & Trophies';

    // 3. Static GK: Heritage, Org, Census, Days
    if (/\b(unesco|world heritage|terracotta|temple|monument|caves?|ajanta|ellora|elephanta|konark|khajuraho|red fort|taj mahal|qutb minar|brihadisvara|shore temple|sun temple)\b/i.test(s)) return 'Temples, Monuments & Heritage Sites';
    if (/\b(brics|asean|saarc|united nations|\bun\b|who|unicef|imf|world bank|wto|nato|ilo|unep|headquarters)\b/i.test(s)) return 'International Organisations';
    if (/\b(census|literacy rate|sex ratio|population density)\b/i.test(s)) return 'Census & Demographics';
    if (/\b(celebrated on|observed on|world environment day|earth day|water day|international yoga day|theme of|ai hackathon 2025|important day)\b/i.test(s)) return 'Important Days & Themes';

    // 4. History (Ancient, Medieval, Modern)
    if (/\b(harappan|indus valley|mohenjo|vedic|rigveda|upanishad|buddhism|buddha|jainism|mahavira|tirthankara|maurya|ashoka|chandragupta|magadha|mahajanapada|gupta|harshavardhana|sangam|stone age|paleolithic|neolithic|mesolithic|rajendra i|chola dynasty|pallava|chalukya)\b/i.test(s)) return 'Ancient History';
    if (/\b(firoz tughlaq|delhi sultanate|slave dynasty|khilji|tughlaq|lodhi|sayyid|mughal|babur|humayun|akbar|jahangir|shah jahan|aurangzeb|maratha|shivaji|peshwa|vijayanagar|bahmani|jayapala|battle of peshawar|tansen)\b/i.test(s)) return 'Medieval History';
    if (/\b(east india company|battle of plassey|battle of buxar|governor-general|viceroy|lord lansdowne|lord dalhousie|lord curzon|lord canning|revolt of 1857|sepoy mutiny|indian national congress|gandhi|non-cooperation|civil disobedience|quit india|cabinet mission|partition of bengal|act allotted ₹1 lakh|government of india act|lala lajpat rai|princely states|battle of aliwal|khalsa army|british-era structures|james wilson)\b/i.test(s)) return 'Modern History';

    // 5. Polity
    if (/\b(fundamental rights?|fundamental duties|dpsp|directive principles|article 1[4-9]|article 2[0-9]|article 3[0-2]|article 51a|habeas corpus|mandamus)\b/i.test(s)) return 'Fundamental Rights & Duties';
    if (/\b(president of india|vice president|prime minister|council of ministers|governor|chief minister|supreme leader)\b/i.test(s)) return 'Union & State Executive';
    if (/\b(parliament|lok sabha|rajya sabha|speaker|money bill|state legislative assembly|vidhan sabha|death penalty)\b/i.test(s)) return 'Parliament & State Legislature';
    if (/\b(supreme court|high court|chief justice|judicial review|writs?)\b/i.test(s)) return 'Judiciary';
    if (/\b(panchayat|panchayati raj|73rd amendment|74th amendment|municipality|gram sabha)\b/i.test(s)) return 'Panchayati Raj & Local Government';
    if (/\b(constitution|preamble|constituent assembly|schedule \d+|amendment|article \d+|election commission|cag)\b/i.test(s)) return 'Indian Polity & Constitution';

    // 6. Geography
    if (/\b(national park|wildlife sanctuary|biosphere reserve|tiger reserve|mudumalai|biodiversity|endangered spec|critically endangered)\b/i.test(s)) return 'National Parks & Environment';
    if (/\b(himalaya|river|ganga|indus|brahmaputra|godavari|krishna|kaveri|narmada|tapti|western ghats|eastern ghats|delta|tributary|ujh multipurpose|fossil parks|rohtang tunnel)\b/i.test(s)) return 'Indian Drainage & Physiography';
    if (/\b(monsoon|soil|alluvial|black soil|laterite|climate|rainfall)\b/i.test(s)) return 'Indian Climate & Soil';
    if (/\b(earth rotation|earthquake|volcano|atmosphere|troposphere|stratosphere|ocean current|tides?|solar system)\b/i.test(s)) return 'Physical Geography';
    if (/\b(continent|desert|sahara|strait|equator|tropic of)\b/i.test(s)) return 'World Geography';

    // 7. Economics
    if (/\b(rbi|reserve bank|repo rate|monetary policy|bank rate|inflation|deflation|money supply)\b/i.test(s)) return 'Banking & Monetary Policy';
    if (/\b(budget|fiscal policy|fiscal deficit|direct tax|indirect tax|gst|income tax)\b/i.test(s)) return 'Fiscal Policy & Budget';
    if (/\b(gdp|gnp|national income|per capita income|economic growth|five year plan)\b/i.test(s)) return 'Macroeconomics & National Income';
    if (/\b(demand|supply|elasticity|monopoly|market)\b/i.test(s)) return 'Microeconomics & Markets';
    if (/\b(pmay|pradhan mantri awas|sampann|scheme|agriculture are given below)\b/i.test(s)) return 'Government Schemes & Policies';

    // 8. General Science: Biology, Chemistry, Physics
    if (/\b(cell|mitochondria|dna|rna|hormone|enzyme|vitamin|disease|bacteria|virus|food- \(i\) sugar|autism|asd|preserving food|human ear)\b/i.test(s)) return 'Biology';
    if (/\b(acid|base|chemical|periodic table|atomic|metal|non-metal|ndma|nitrosamine)\b/i.test(s)) return 'Chemistry';
    if (/\b(newton|velocity|force|gravity|energy|power|light|speed of light|vacuum|sound|frequency|electricity|voltage|distance–time graph|uniform speed|amca|combat aircraft|exercise rotor clap)\b/i.test(s)) return 'Physics';

    return 'Static GK';
  }

  return 'General';
}
