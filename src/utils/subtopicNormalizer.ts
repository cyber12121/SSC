import type { Question } from '../types';

/**
 * Standardizes and normalizes subtopics across all SSC CGL chapters/topics
 * ensuring MAX 7-8 canonical subtopics per chapter.
 */

// Stop words for generic keyword cleaning
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'of', 'a', 'an', 'in', 'on', 'by', 'to', 'for',
  'with', 'from', 'its', 'is', 'are', 'was', 'were', 'be', 'been',
  'basic', 'advanced', 'concept', 'problems', 'based', 'type', 'questions'
]);

export function cleanSubtopicText(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s*\(.*?\)/g, '')       // remove parentheticals like (Basic), (Advanced)
    .replace(/[\[\]]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\//g, ' or ')
    .replace(/[-_–—]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a raw subtopic string into one of the canonical 6-8 subtopics for the given chapter/topic.
 */
export function normalizeSubtopic(
  topic: string,
  rawSubtopic?: string | null,
  questionText?: string | null,
  extraContext?: string | null
): string {
  const top = (topic || '').trim();
  const sub = cleanSubtopicText(rawSubtopic || '');
  const extra = cleanSubtopicText(extraContext || '');
  const s = `${sub} ${extra} ${cleanSubtopicText(questionText || '')}`.toLowerCase();

  // ══════════════════════════════════════════════════════════════════════
  // QUANTITATIVE APTITUDE
  // ══════════════════════════════════════════════════════════════════════

  if (/profit,?\s*loss/i.test(top)) {
    if (/dishonest|false weight|faulty|cheating|weights/.test(s)) return 'Dishonest Dealer & False Weights';
    if (/marked|discount|successive discount|m\.p|list price|buy.*get|free article/.test(s)) return 'Marked Price & Discounts';
    if (/successive transaction|buyback|chain sale|sold to.*then sold/.test(s)) return 'Successive Transactions';
    if (/installment|credit/.test(s)) return 'Installments & Credit';
    if (/quantity|article|variation|per rupee|multiple article|buy.*at.*sell/.test(s)) return 'Quantity & Article Variations';
    if (/equal.*sp|equal.*cp|same sp|same cp|sp relation|cp relation|equivalent cost/.test(s)) return 'Equal SP & CP Relations';
    return 'Basic CP, SP & Profit/Loss%';
  }

  if (/percentage/i.test(top)) {
    if (/pass|fail|examination|marks|short by|minimum marks/.test(s)) return 'Exam Marks & Pass/Fail';
    if (/price.*consumption|consumption.*expenditure|expenditure/.test(s)) return 'Price, Consumption & Expenditure';
    if (/population|depreciation|depreciates|birth rate/.test(s)) return 'Population & Depreciation';
    if (/income|savings|salary|spends.*income/.test(s)) return 'Income, Expenditure & Savings';
    if (/venn|two set|both pass|neither|both play/.test(s)) return 'Venn Diagrams & Sets';
    if (/election|votes|voting|candidate|majority/.test(s)) return 'Election Problems';
    if (/fraction|ratio|increase|decrease|more than|less than/.test(s)) return 'Percentage Change & Comparison';
    return 'Basic Percentage Calculations';
  }

  if (/time,?\s*speed\s*(&|and)?\s*distance/i.test(top)) {
    if (/train|platform|pole|bridge|length of train/.test(s)) return 'Trains (Poles, Platforms & Lengths)';
    if (/boat|stream|upstream|downstream|still water|current/.test(s)) return 'Boats & Streams';
    if (/circular|race|track|running in circle|laps/.test(s)) return 'Races & Circular Tracks';
    if (/relative|catch|police|thief|chase|opposite direction|same direction/.test(s)) return 'Relative Speed & Police-Thief';
    if (/average speed|harmonic mean|equal distance|equal time/.test(s)) return 'Average Speed';
    if (/stoppage|delay|halts|late|early/.test(s)) return 'Delays, Early-Late & Stoppages';
    return 'Basic Speed, Time & Distance';
  }

  if (/time\s*(&|and)?\s*work/i.test(top)) {
    if (/pipe|cistern|leak|emptying|filling|tap/.test(s)) return 'Pipes & Cisterns';
    if (/alternate|rotational|turn/.test(s)) return 'Alternate Days Work';
    if (/men.*women|women.*children|boy|wage|daily wage|share of money/.test(s)) return 'Men, Women, Wages & Efficiency';
    if (/chain rule|mdh|men.*days.*hours|compound proportion/.test(s)) return 'MDH Formula & Chain Rule';
    if (/leave|left|join|before completion|after \d+ days/.test(s)) return 'Leaving & Joining Work';
    if (/efficiency|twice as fast|ratio of efficiency/.test(s)) return 'Work Efficiency & Ratios';
    return 'Basic Work & Days Calculation';
  }

  if (/ratio\s*(&|and)?\s*proportion/i.test(top)) {
    if (/\b(ages?|present age)\b|father.*son|years ago|hence/.test(s)) return 'Age Problems';
    if (/coin|rupee|fifty paise|twenty five paise|denomination|currency/.test(s)) return 'Coins & Currency Problems';
    if (/mixture|alligation|milk.*water|alloy|replaced/.test(s)) return 'Mixture & Alligation Ratios';
    if (/income|expenditure|savings|salaries/.test(s)) return 'Income, Expense & Savings Ratios';
    if (/mean proportional|third proportional|fourth proportional|continuous|continued/.test(s)) return 'Mean, Third & Fourth Proportional';
    if (/combined|a : b|duplicate|subduplicate|triplicate/.test(s)) return 'Combined Ratios (A:B:C:D)';
    return 'Basic Ratio & Distribution';
  }

  if (/algebra/i.test(top)) {
    if (/x\s*\+\s*1\s*\/\s*x|x\^2\s*\+\s*1\s*\/\s*x\^2|x\^3\s*\+\s*1\s*\/\s*x\^3|reciprocal/.test(s)) return 'Identities with x + 1/x';
    if (/a\s*\+\s*b\s*\+\s*c\s*=\s*0|conditional|a\^3\s*\+\s*b\^3\s*\+\s*c\^3/.test(s)) return 'Conditional Identities (a+b+c=0)';
    if (/quadratic|roots|discriminant|alpha|beta|equation/.test(s)) return 'Quadratic Equations & Roots';
    if (/polynomial|factor|remainder theorem|degree|coefficient/.test(s)) return 'Polynomials & Factorization';
    if (/linear equation|system of equations|two variables|three variables/.test(s)) return 'Linear Equations';
    if (/maximum|minimum|maxima|minima|value putting/.test(s)) return 'Maxima, Minima & Value Putting';
    return 'Basic Algebraic Identities';
  }

  // Coordinate Geometry (CHECK BEFORE generic /geometry/)
  if (/coordinate\s*geometry/i.test(top)) {
    if (/slope|equation of line|intercept|gradient|parallel line|perpendicular line/.test(s)) return 'Slope & Equations of Lines';
    if (/distance|section|midpoint|internal division|external division/.test(s)) return 'Distance & Section Formula';
    if (/intersection|concurrent|collinear|point on line/.test(s)) return 'Intersection of Lines & Collinearity';
    if (/area.*triangle|vertices.*triangle|area.*quadrilateral/.test(s)) return 'Area of Triangles & Quadrilaterals';
    if (/reflection|mirror image|axis reflection/.test(s)) return 'Reflection & Coordinate Transformations';
    if (/circle|radius|centre/.test(s)) return 'Circles in Coordinates';
    return 'Basic Coordinate Geometry';
  }

  if (/geometry/i.test(top)) {
    if (/circle|chord|tangent|secant|cyclic|segment|radius/.test(s)) return 'Circles (Tangents, Chords & Secants)';
    if (/incenter|circumcenter|centroid|orthocenter|angle bisector|median|altitude/.test(s)) return 'Centers of Triangles';
    if (/similarity|congruence|midpoint|basic proportionality|thales/.test(s)) return 'Triangle Similarity & Congruence';
    if (/quadrilateral|parallelogram|rhombus|trapezium|rectangle|square/.test(s)) return 'Quadrilaterals & Polygons';
    if (/right angle|pythagoras|hypotenuse|triplet/.test(s)) return 'Right Triangles & Pythagoras';
    if (/exterior angle|interior angle|angle sum|parallel lines/.test(s)) return 'Lines & Angles Properties';
    return 'General Triangle Properties';
  }

  if (/mensuration\s*3d/i.test(top)) {
    if (/cylinder/.test(s) && !/cube|comb/.test(s)) return 'Cylinder (Solid & Hollow)';
    if (/sphere|hemisphere/.test(s)) return 'Sphere & Hemisphere';
    if (/cone|frustum/.test(s)) return 'Cone & Frustum';
    if (/cube|cuboid/.test(s) && !/comb/.test(s)) return 'Cube & Cuboid';
    if (/pyramid|prism|tetrahedron/.test(s)) return 'Prism & Pyramid';
    if (/melt|cast|recast|conversion|drawn into/.test(s)) return 'Melting & Conversion of Solids';
    if (/combination|composite|packing|surmounted|cavity/.test(s)) return 'Combination & Cutting of Solids';
    return 'General 3D Mensuration';
  }

  if (/mensuration\s*2d/i.test(top)) {
    if (/sector|arc|segment|radian/.test(s)) return 'Sectors & Arcs of Circles';
    if (/circle|semicircle|ring|annulus/.test(s)) return 'Circles, Semicircles & Rings';
    if (/triangle|heron|equilateral|isosceles/.test(s)) return 'Triangles & Area Calculations';
    if (/rhombus|trapezium|parallelogram/.test(s)) return 'Rhombus, Trapezium & Parallelogram';
    if (/rectangle|square|diagonal|fencing|cost/.test(s)) return 'Rectangle & Square (Paths & Fencing)';
    if (/polygon|hexagon|octagon/.test(s)) return 'Regular Polygons';
    return 'General 2D Area & Perimeter';
  }

  if (/height\s*(&|and)?\s*distance/i.test(top)) {
    if (/elevation.*depression|depression.*elevation|two positions|same side|opposite side/.test(s)) return 'Two Points on Same/Opposite Side';
    if (/depression/.test(s)) return 'Angle of Depression';
    if (/elevation|building height|tower height/.test(s)) return 'Angle of Elevation & Heights';
    if (/shadow|sun altitude|pole.*shadow/.test(s)) return 'Shadow & Sun Altitude';
    if (/broken|tree.*broken|flagstaff/.test(s)) return 'Broken Trees & Flagstaff';
    return 'Heights & Distances';
  }

  if (/trigonometry/i.test(top)) {
    if (/height|distance|elevation|depression|shadow|tower|pole|cliff/.test(s)) return 'Heights & Distances';
    if (/\b(max|min|maximum|minimum|maxima|minima|greatest|least)\b/.test(s)) return 'Maximum & Minimum Values';
    if (/complementary|supplementary|90\s*-\s*theta|co-function/.test(s)) return 'Complementary Angles';
    if (/\b(0|30|45|60|90)\b|standard value|table value/.test(s)) return 'Standard Angle Ratios';
    if (/identity|sin\^2|cos\^2|sec\^2|tan\^2|cosec\^2|cot\^2/.test(s)) return 'Trigonometric Identities';
    if (/radian|degree|circular measure/.test(s)) return 'Radian & Circular Measurement';
    return 'Trigonometric Ratios & Simplification';
  }

  if (/compound\s*interest/i.test(top) || /simple\s*interest/i.test(top) || /simple.*compound/i.test(top)) {
    if (/difference between (ci|si)|ci.*si difference|si.*ci difference/.test(s)) return 'Difference Between CI & SI';
    if (/installment|annual payment|borrowed|debt/.test(s)) return 'Installments & Repayments';
    if (/half yearly|quarterly|8 monthly|semi annually/.test(s)) return 'Compounding Periods (Half-Yearly/Quarterly)';
    if (/equal interest|invested in two parts|three parts/.test(s)) return 'Equal Interest & Division in Parts';
    if (/population|growth|depreciation|scrap value/.test(s)) return 'Population Growth & Depreciation';
    if (/rate.*time|times of itself|doubles|triples/.test(s)) return 'Multiplier & Rate-Time Relations';
    if (/\b(simple interest|s\.i\.|si)\b/i.test(s) && !/compound/i.test(s)) return 'Basic Simple Interest';
    if (/compound interest|c\.i\./i.test(s)) return 'Basic Compound Interest';
    return /simple/i.test(top) ? 'Basic Simple Interest' : 'Basic Compound Interest';
  }

  if (/number\s*system/i.test(top)) {
    if (/divisib|divisible by|remainder theorem|division algorithm/.test(s)) return 'Divisibility Rules & Remainders';
    if (/unit digit|last digit|tens digit/.test(s)) return 'Unit Digit & Tens Digit';
    if (/zero|number of zeroes|trailing zeroes|factorial/.test(s)) return 'Number of Zeroes & Factorials';
    if (/prime|composite|factors|number of factors|sum of factors/.test(s)) return 'Prime Numbers & Factors';
    if (/fraction|recurring|decimal|bar|terminating/.test(s)) return 'Decimals & Recurring Fractions';
    if (/ap|gp|arithmetic progression|geometric|series|sum of first/.test(s)) return 'AP, GP & Series Sum';
    return 'Number Properties & Basic Operations';
  }

  if (/lcm\s*(&|and)?\s*hcf/i.test(top)) {
    if (/circular track|bell|bells ring|traffic light|intervals?|simultaneous/.test(s)) return 'Circular Tracks & Bells Intervals';
    if (/relation between|product of (two )?numbers|sum of numbers.*lcm/.test(s)) return 'Relation between LCM & HCF';
    if (/remainder.*lcm|least number.*divided by.*remainder|divisible.*remainder/.test(s)) return 'Remainder-based LCM Problems';
    if (/greatest number.*divides.*leaving|equal division|hcf.*remainder/.test(s)) return 'Remainder-based HCF & Partitioning';
    if (/fraction|decimal|polynomial/.test(s)) return 'Fractions & Decimals LCM-HCF';
    if (/tile|tiling|capacity|partition|minimum can/.test(s)) return 'Tiling & Capacity Applications';
    return 'LCM & HCF Applications';
  }

  if (/simplification/i.test(top)) {
    if (/surd|indices|root|power|exponent|rationalize/.test(s)) return 'Surds & Indices';
    if (/\b(bodmas|vbodmas|bracket|brackets)\b|order of operations?/.test(s)) return 'VBODMAS & Order of Operations';
    if (/fraction|mixed fraction|continued fraction/.test(s)) return 'Fractions & Continued Fractions';
    if (/algebraic simplification|identit/.test(s)) return 'Algebraic Simplification';
    if (/decimal|bar|recurring/.test(s)) return 'Decimals & Recurring Fractions';
    return 'Basic Calculation & Simplification';
  }

  if (/partnership/i.test(top)) {
    if (/modified capital|capital adjustment|changes? capital|mid.*year|withdrew|invested more/.test(s)) return 'Mid-Term Capital Changes';
    if (/capital.*time|time.*variation|different periods?/.test(s)) return 'Capital & Time Ratio Variations';
    if (/fractional capital|simple partnership/.test(s)) return 'Fractional & Proportionate Capital';
    if (/charity|salary|working partner|sleeping partner|commission/.test(s)) return 'Salary, Charity & Commission';
    if (/rent|pasture|grazing|consumption/.test(s)) return 'Rent & Equivalent Consumption';
    return 'Profit Sharing & Basic Partnership';
  }

  if (/pipes?\s*(&|and)?\s*cisterns?/i.test(top)) {
    if (/alternate|alternatively|one by one/.test(s)) return 'Alternate Filling & Emptying';
    if (/leak|emptying|leakage/.test(s)) return 'Leaks & Emptying Pipes';
    if (/multiple inlet|combined flow|three pipes/.test(s)) return 'Multiple Inlets & Combined Flow';
    if (/efficiency|twice as fast|diameter/.test(s)) return 'Pipe Efficiency & Flow Rates';
    if (/closed before|turned off/.test(s)) return 'Pipes Closed Before Full';
    return 'Inlet & Outlet Pipes';
  }

  if (/probability/i.test(top)) {
    if (/dependent|without replacement|selection/.test(s)) return 'Dependent Events & Selection';
    if (/independent|derangement|complementary/.test(s)) return 'Independent Events & Derangements';
    if (/coin|toss/.test(s)) return 'Coin Tossing Probability';
    if (/dice|cards|deck/.test(s)) return 'Dice & Card Pack Probability';
    return 'Basic Probability Concepts';
  }

  if (/statistics/i.test(top)) {
    if (/grouped data|frequency|class interval/.test(s)) return 'Grouped Data & Frequency';
    if (/empirical relationship|empirical relation|mode.*3.*median/.test(s)) return 'Empirical Relation (Mean, Median, Mode)';
    if (/standard deviation|variance|dispersion/.test(s)) return 'Standard Deviation & Variance';
    if (/measures of central tendency|mean.*median|mean|median|mode/.test(s)) return 'Measures of Central Tendency';
    return 'Basic Statistical Calculations';
  }

  if (/trains?/i.test(top)) {
    if (/pole|man|standing|post|telegraph/.test(s)) return 'Crossing Poles & Standing Persons';
    if (/platform|bridge|tunnel/.test(s)) return 'Crossing Platforms & Bridges';
    if (/opposite direction|same direction|relative speed/.test(s)) return 'Relative Speed & Direction';
    if (/delayed start|leaves at|meets/.test(s)) return 'Delayed Starts & Meeting Points';
    return 'Basic Train Calculations';
  }

  if (/boats?\s*(&|and)?\s*streams?/i.test(top)) {
    if (/equal time|same time|round trip/.test(s)) return 'Round Trips & Equal Time Equations';
    if (/still water|speed of stream|stream speed/.test(s)) return 'Still Water & Stream Speed';
    if (/speed relations|equations|ratio/.test(s)) return 'Speed Relations & Equations';
    return 'Upstream & Downstream Calculations';
  }

  if (/average/i.test(top)) {
    if (/batting|bowling|innings|batsman|cricket|runs/.test(s)) return 'Cricket & Sports Average';
    if (/\b(ages?|family members?|family average)\b|father.*son|average age of/.test(s)) return 'Age-based Averages';
    if (/weighted|combined average|two groups/.test(s)) return 'Weighted & Combined Average';
    if (/consecutive|ap|arithmetic progression|multiples|even.*odd/.test(s)) return 'Consecutive Numbers & AP Average';
    if (/error|wrongly entered|corrected average|mistake/.test(s)) return 'Average Error Correction';
    if (/inclusion|exclusion|member|leaves|joins|replacement|added.*group|new observation/.test(s)) return 'Inclusion, Exclusion & Replacement';
    return 'Basic Average Calculation';
  }

  if (/mixture\s*(&|and)?\s*alligation/i.test(top)) {
    if (/replacement|drawn out and replaced|repeated replacement/.test(s)) return 'Repeated Replacement Formula';
    if (/alligation rule|cheaper|dearer|mean price/.test(s)) return 'Rule of Alligation';
    if (/alloy|metals|brass|bronze/.test(s)) return 'Alloys & Multi-Component Mixtures';
    return 'Two-Liquid Mixtures & Ratios';
  }

  if (/data\s*interpretation/i.test(top)) {
    if (/pie chart/.test(s)) return 'Pie Charts';
    if (/bar graph|histogram/.test(s)) return 'Bar Graphs';
    if (/line graph/.test(s)) return 'Line Graphs';
    if (/table|tabular/.test(s)) return 'Tables & Tabular Data';
    return 'Mixed Data Interpretation';
  }

  // ══════════════════════════════════════════════════════════════════════
  // ENGLISH LANGUAGE
  // ══════════════════════════════════════════════════════════════════════

  if (/active\s*(&|and|\/|to)?\s*passive/i.test(top) || /voice/i.test(top)) {
    if (/modal|can|could|may|might|must|should|ought/.test(s)) return 'Modal Auxiliaries';
    if (/interrogat|wh-|question|did|does|do/.test(s)) return 'Interrogative Sentences';
    if (/imperat|order|request|command|advice|let/.test(s)) return 'Imperative Sentences';
    if (/infinitive|gerund|participle|to be/.test(s)) return 'Infinitives & Gerunds';
    if (/causative|reporting|impersonal|it is said|there is/.test(s)) return 'Causative & Impersonal Passives';
    if (/passive to active|conversion to active/.test(s)) return 'Passive to Active Conversion';
    if (/tense|present|past|future|continuous|perfect/.test(s)) return 'Tense Conversions';
    return 'Basic Voice Change Rules';
  }

  if (/direct\s*(&|and|\/|to)?\s*indirect/i.test(top) || /narration/i.test(top) || /speech/i.test(top)) {
    if (/interrogat|wh-|if|whether|question/.test(s)) return 'Interrogative Sentences';
    if (/imperat|order|requested|commanded|forbade/.test(s)) return 'Imperative Sentences';
    if (/exclamat|optative|wished|prayed|exclaimed/.test(s)) return 'Exclamatory & Optative Sentences';
    if (/tense|past perfect|present to past/.test(s)) return 'Tense Change Rules';
    if (/pronoun|time|place|now.*then|today.*that day/.test(s)) return 'Pronoun & Time-Place Changes';
    if (/indirect to direct/.test(s)) return 'Indirect to Direct Conversion';
    return 'Assertive Sentences & Reporting Verbs';
  }

  if (/spotting\s*errors/i.test(top) || /sentence\s*improvement/i.test(top) || /fill\s*in\s*the\s*blanks?/i.test(top)) {
    const rawClean = (rawSubtopic || '').toLowerCase();
    const isCorruptOrGenericRaw = /articles?\s*(&|and)?\s*determiners?|general\s*concepts?|grammar\s*(&|and)?\s*syntax/i.test(rawClean);
    const diag = `${!isCorruptOrGenericRaw ? rawClean : ''} ${(extraContext || '').toLowerCase()}`.trim();
    const qStr = (questionText || '').toLowerCase();
    const combined = `${diag} ${qStr}`;

    // 1. Spelling / Misspelt Errors
    if (/\b(spell|spelling|misspelt|misspelled|wrongly spelt|incorrectly spelt)\b/i.test(diag) ||
        /\b(spelling error|misspelt word|incorrectly spelt)\b/i.test(qStr)) {
      return 'Spelling Errors';
    }

    // 2. Subject-Verb Agreement
    if (/\b(subject\s*verb|subject-verb|agreement|singular\s*verb|plural\s*verb|verb\s*agreement|neither\s*of|either\s*of|one\s*of\s*the|each\s*of)\b/i.test(diag) ||
        /\b(neither of|either of|each of|one of the|along with|as well as|together with)\b/i.test(qStr)) {
      return 'Subject-Verb Agreement';
    }

    // 3. Conjunctions & Parallelism
    if (/\b(conjunction|correlative|parallelism|scarcely\s*when|hardly\s*when|no\s*sooner\s*than|not\s*only\s*but\s*also|lest|neither\s*nor|either\s*or)\b/i.test(diag) ||
        /\b(no sooner\b.*\bthan|hardly\b.*\bwhen|scarcely\b.*\bwhen|not only\b.*\bbut also|neither\b.*\bnor|either\b.*\bor)\b/i.test(qStr)) {
      return 'Conjunctions & Parallelism';
    }

    // 4. Prepositions & Phrasal Verbs
    if (/\b(preposition|prepositional|phrasal\s*verb|fixed\s*preposition|dispense\s*with|prone\s*to|cope\s*with|accused\s*of|abstain\s*from|refrain\s*from)\b/i.test(diag)) {
      return 'Prepositions & Phrasal Verbs';
    }

    // 5. Tenses & Conditionals
    if (/\b(tense|conditional|if\s*clause|subjunctive|past\s*perfect|simple\s*past|present\s*perfect|had\s*been|hypothetical|would\s*have)\b/i.test(diag) ||
        /\b(had\b.*\bwould have|if\s+i\s+were|if\s+it\s+were)\b/i.test(qStr)) {
      return 'Tenses & Conditionals';
    }

    // 6. Verbs, Modals & Non-Finites
    if (/\b(gerund|infinitive|participle|bare\s*infinitive|non\s*finite|modal|passive\s*voice|active\s*voice|causative|verb\s*form|transitive|intransitive)\b/i.test(diag)) {
      return 'Verbs, Modals & Non-Finites';
    }

    // 7. Pronouns & Modifiers
    if (/\b(pronoun|relative\s*pronoun|who\s*vs\s*whom|antecedent|modifier|dangling|misplaced|reflexive|each\s*other|one\s*another)\b/i.test(diag) ||
        /\b(who\b.*\bwhom|one another|each other)\b/i.test(qStr)) {
      return 'Pronouns & Modifiers';
    }

    // 8. Adjectives & Adverbs
    if (/\b(adjective|adverb|comparative|superlative|degree\s*of\s*comparison|double\s*comparative|inversion|hardly\b|seldom\b|scarcely\b|little\s*vs\s*few)\b/i.test(diag)) {
      return 'Adjectives & Adverbs';
    }

    // 9. Nouns & Question Tags
    if (/\b(noun|uncountable|collective\s*noun|question\s*tag|plural\s*noun|apostrophe|hyphenated\s*noun)\b/i.test(diag)) {
      return 'Nouns & Question Tags';
    }

    // 10. Articles & Determiners - ONLY if explicitly specified in diagnostic text or clean rawSubtopic
    if (/\b(article|articles|determiner|determiners|definite\s*article|indefinite\s*article|a\s*vs\s*an|an\s*vs\s*a|omission\s*of\s*article|zero\s*article|use\s*of\s*the|much\s*vs\s*many)\b/i.test(diag) ||
        (/article|determiner/i.test(rawClean) && !/grammar\s*(&|and)?\s*syntax/i.test(rawClean))) {
      return 'Articles & Determiners';
    }

    if (/subject.*verb|agreement/.test(combined)) return 'Subject-Verb Agreement';
    if (/preposition|phrasal/.test(combined)) return 'Prepositions & Phrasal Verbs';
    if (/tense|conditional/.test(combined)) return 'Tenses & Conditionals';
    if (/conjunction|parallel/.test(combined)) return 'Conjunctions & Parallelism';
    if (/pronoun/.test(combined)) return 'Pronouns & Modifiers';
    if (/adjective|adverb/.test(combined)) return 'Adjectives & Adverbs';

    return 'Grammar & Syntax Errors';
  }

  if (/synonyms?\s*(&|and)?\s*antonyms?/i.test(top) || /vocabulary/i.test(top)) {
    if (/synonym|similar meaning|closest meaning/.test(s)) return 'Synonyms';
    if (/antonym|opposite meaning/.test(s)) return 'Antonyms';
    if (/homonym|confusable|paronym/.test(s)) return 'Homonyms & Confusable Words';
    return 'Vocabulary Meaning & Context';
  }

  if (/one\s*word/i.test(top) || /ows/i.test(top)) {
    if (/person|profession|specialist|phobia|mania/.test(s)) return 'Persons, Phobias & Manias';
    if (/government|system|rule|theocracy|oligarchy/.test(s)) return 'Forms of Government & Society';
    if (/death|funeral|killing|cide|burial/.test(s)) return 'Killing, Death & Memorials';
    if (/science|study|art|ology/.test(s)) return 'Sciences & Studies';
    return 'General One Word Substitutes';
  }

  if (/idioms?\s*(&|and)?\s*phrases?/i.test(top)) {
    if (/animal|bird|colour|color|body part/.test(s)) return 'Body Parts, Animals & Colours';
    if (/proverb|saying/.test(s)) return 'Common Proverbs';
    return 'Idioms & Idiomatic Expressions';
  }

  if (/cloze/i.test(top) || /reading\s*comprehension/i.test(top) || /para\s*jumbles?/i.test(top)) {
    if (/para jumble|rearrangement|order|pqrs|sentence sequence/.test(s)) return 'Para Jumbles & Rearrangement';
    if (/grammar filler|preposition in blank|tense in blank/.test(s)) return 'Grammar Based Fillers';
    if (/vocab|word choice|contextual filler/.test(s)) return 'Vocabulary Based Fillers';
    if (/tone|theme|title|main idea/.test(s)) return 'Tone, Theme & Main Idea';
    if (/inference|author view|implied/.test(s)) return 'Inference & Author Perspective';
    return 'Fact & Detail Comprehension';
  }

  if (/spelling/i.test(top)) {
    if (/double letter|silent letter/.test(s)) return 'Double & Silent Letters';
    if (/prefix|suffix|ending/.test(s)) return 'Prefixes & Suffixes';
    return 'Misspelt Words';
  }

  // ══════════════════════════════════════════════════════════════════════
  // REASONING (GENERAL INTELLIGENCE)
  // ══════════════════════════════════════════════════════════════════════

  if (/coding\s*[-–]?\s*decoding/i.test(top)) {
    if (/letter.*letter|shift|opposite letter|forward backward/.test(s)) return 'Letter Shift & Pattern Coding';
    if (/number|digit|position value|sum of positions/.test(s)) return 'Number & Value Coding';
    if (/substitution|decipher|chinese coding|common word/.test(s)) return 'Substitution & Deciphering';
    if (/matrix|symbol/.test(s)) return 'Symbol & Matrix Coding';
    return 'Pattern Coding & Decoding';
  }

  if (/series/i.test(top)) {
    if (/missing number|next number/.test(s)) return 'Missing Number Series';
    if (/wrong number|breaks the pattern/.test(s)) return 'Wrong Number Series';
    if (/continuous|repeating letter|fill the blank in series/.test(s)) return 'Continuous Pattern Letter Series';
    if (/alphanumeric|letter and number/.test(s)) return 'Alphanumeric Series';
    return 'Letter & Symbol Series';
  }

  if (/analogy/i.test(top)) {
    if (/number|digit|cube|square|operation/.test(s)) return 'Number & Set Analogy';
    if (/letter|alphabet|shift/.test(s)) return 'Letter & Alphabet Analogy';
    if (/general knowledge|state|capital|currency|instrument/.test(s)) return 'GK Based Word Analogy';
    return 'Semantic & Word Analogy';
  }

  if (/classification/i.test(top) || /odd\s*one\s*out/i.test(top)) {
    if (/number|digit/.test(s)) return 'Number Classification';
    if (/letter|alphabet/.test(s)) return 'Letter Classification';
    return 'Word & Semantic Classification';
  }

  if (/blood\s*relation/i.test(top)) {
    if (/coded|a \+ b|p x q/.test(s)) return 'Coded Blood Relations';
    if (/pointing|photograph|introducing|said pointing/.test(s)) return 'Pointing / Indicating Form';
    return 'Family Tree & Direct Relations';
  }

  if (/direction/i.test(top)) {
    if (/shortest distance|pythagoras|displacement/.test(s)) return 'Shortest Distance (Pythagoras)';
    if (/degree|turn|clockwise|anticlockwise|angle/.test(s)) return 'Turns, Angles & Rotations';
    if (/shadow|sunrise|sunset/.test(s)) return 'Shadow & Sun Direction';
    return 'Cardinal Directions & Turns';
  }

  if (/syllogism/i.test(top)) {
    if (/\b(possibility|can be|may be|is a possibility)\b/.test(s)) return 'Possibility Cases';
    if (/\b(either.*or|neither.*nor|complementary)\b/.test(s)) return 'Either-Or Cases';
    if (/\b(only a few|only few|only [a-z]+ are)\b/.test(s)) return 'Only & Only A Few Cases';
    if (/\b(no [a-z]+ is|some [a-z]+ are not)\b/.test(s)) return 'Negative Conclusions (No/Some Not)';
    return 'Standard Syllogism (Venn)';
  }

  if (/order\s*(&|and)?\s*ranking/i.test(top)) {
    if (/interchange of positions|interchanged/.test(s)) return 'Position Interchange Ranking';
    if (/total persons|total students|from left.*from right|top.*bottom/.test(s)) return 'Total Persons & Direct Ranking';
    if (/overlap|between them|minimum persons/.test(s)) return 'Overlapping & Between Problems';
    if (/taller|heavier|shorter|more marks|comparison/.test(s)) return 'Comparison Ranking (Height/Weight)';
    return 'Order & Ranking Calculations';
  }

  if (/seating/i.test(top)) {
    if (/circular|circle|round table/.test(s)) return 'Circular Seating Arrangement';
    if (/parallel|facing each other|two rows/.test(s)) return 'Parallel Rows Seating';
    if (/square|rectangle/.test(s)) return 'Square & Rectangular Seating';
    return 'Linear Seating Arrangement';
  }

  if (/figure\s*counting/i.test(top) || (/non\s*verbal|figure/i.test(top) && /count/i.test(s))) {
    if (/triangle/.test(s)) return 'Counting Triangles';
    if (/square|rectangle/.test(s)) return 'Counting Squares & Rectangles';
    if (/straight line|circle/.test(s)) return 'Counting Straight Lines & Circles';
    return 'Complex Figure Counting';
  }

  if (/cube|dice/i.test(top)) {
    if (/open dice|unfolded|folding|folded into/.test(s)) return 'Open Dice & Folding Patterns';
    if (/painted|cut into|smaller cubes|faces painted/.test(s)) return 'Painted Faces & Cube Cutting';
    if (/opposite face|adjacent face|opposite to/.test(s)) return 'Opposite Faces of Dice';
    return 'Cube & Dice (Opposite Faces)';
  }

  if (/non\s*verbal/i.test(top) || /figure/i.test(top) || /paper/i.test(top) || /mirror/i.test(top)) {
    if (/mirror|water image/.test(s)) return 'Mirror & Water Images';
    if (/paper folding|cutting|unfolded/.test(s)) return 'Paper Folding & Cutting';
    if (/embedded|hidden|completion/.test(s)) return 'Embedded Figures & Completion';
    return 'Figure Pattern Series & Analogy';
  }

  if (/alphabet\s*test/i.test(top)) {
    if (/vowel|consonant/.test(s)) return 'Vowel & Consonant Operations';
    if (/letter pair|pairs of letters|forward.*backward/.test(s)) return 'Letter Pairs Problem';
    if (/word rearrangement|alphabetical sorting/.test(s)) return 'Alphabetical Sorting of Words';
    if (/midpoint|middle letter|between/.test(s)) return 'Midpoint & Position Finding';
    return 'Alphabet Order & Operations';
  }

  if (/word\s*formation|dictionary/i.test(top)) {
    if (/dictionary|alphabetical order/.test(s)) return 'Dictionary Arrangement';
    if (/cannot be formed|can be formed|formation/.test(s)) return 'Word Formation from Letters';
    if (/matrix|address matching/.test(s)) return 'Matrix & Address Matching';
    if (/rearrangement|unscramble/.test(s)) return 'Word Rearrangement & Unscrambling';
    return 'Dictionary & Word Formation';
  }

  if (/statement\s*(&|and)?\s*assumption/i.test(top) || /assumption/i.test(top)) {
    if (/policy|government|advertisement|business/.test(s)) return 'Policy & Public Notice Assumptions';
    if (/cause|consequence|action/.test(s)) return 'Action-Oriented Assumptions';
    return 'Statement & Assumptions';
  }

  if (/statement\s*(&|and)?\s*conclusion/i.test(top)) {
    if (/eligibility|criteria/.test(s)) return 'Eligibility Criteria Evaluation';
    if (/conditional|fallacy|fallacies/.test(s)) return 'Conditional Deductions & Fallacies';
    if (/situation|reaction/.test(s)) return 'Situation Reaction & Judgment';
    if (/critical|verbal/.test(s)) return 'Critical Verbal Reasoning';
    return 'Statement & Conclusions';
  }

  if (/statement\s*(&|and)?\s*argument/i.test(top) || /argument/i.test(top)) {
    return 'Strong & Weak Arguments';
  }

  if (/course\s*of\s*action/i.test(top)) {
    return 'Administrative & Problem Solving Actions';
  }

  if (/cause\s*(&|and)?\s*effect/i.test(top)) {
    return 'Principal Cause & Effect';
  }

  if (/mathematical\s*operations/i.test(top)) {
    if (/interchange.*signs.*numbers/.test(s)) return 'Interchange of Signs & Numbers';
    if (/interchange.*signs/.test(s)) return 'Interchange of Signs';
    if (/interchange.*numbers|digits/.test(s)) return 'Interchange of Numbers/Digits';
    if (/balancing|equation correct/.test(s)) return 'Balancing Equations';
    return 'Operator Substitution & BODMAS';
  }

  // ══════════════════════════════════════════════════════════════════════
  // GENERAL AWARENESS (GK / GS)
  // ══════════════════════════════════════════════════════════════════════

  if (/history/i.test(top)) {
    if (/indus|harappa|vedic|buddhism|jainism|maurya|gupta|ashoka/.test(s)) return 'Ancient History (Harappa to Gupta)';
    if (/delhi sultanate|mughal|akbar|maratha|shivaji|vijayanagar/.test(s)) return 'Medieval History (Sultanate & Mughals)';
    if (/1857|revolt|viceroy|governor|british|congress|gandhi|freedom/.test(s)) return 'Modern History & Freedom Movement';
    if (/temple|art|architecture|monument|caves/.test(s)) return 'Art, Architecture & Inscriptions';
    return 'Historical Personalities & Events';
  }

  if (/polity/i.test(top) || /constitution/i.test(top)) {
    if (/fundamental right|fundamental duty|dpsp|directive principle|article 1[4-9]|article 2[0-9]|article 3[2]|article 51a/.test(s)) return 'Fundamental Rights, Duties & DPSP';
    if (/president|governor|prime minister|council of ministers|executive/.test(s)) return 'Union & State Executive';
    if (/parliament|lok sabha|rajya sabha|speaker|bill|assembly/.test(s)) return 'Parliament & State Legislatures';
    if (/supreme court|high court|judiciary|writs|judge/.test(s)) return 'Judiciary & Courts';
    if (/panchayat|municipality|73rd|74th|local government/.test(s)) return 'Panchayati Raj & Local Bodies';
    if (/amendment|schedule|preamble|constituent assembly|articles/.test(s)) return 'Preamble, Schedules & Amendments';
    if (/election commission|cag|upsc|finance commission|attorney general/.test(s)) return 'Constitutional & Statutory Bodies';
    return 'Indian Constitution & Governance';
  }

  if (/geography/i.test(top)) {
    if (/river|ganga|indus|brahmaputra|godavari|tributary|drainage|waterfall|lake/.test(s)) return 'Indian Rivers & Drainage System';
    if (/monsoon|climate|rainfall|soil|alluvial|black soil/.test(s)) return 'Climate, Monsoons & Soils';
    if (/himalaya|western ghats|plateau|mountain|peak|pass/.test(s)) return 'Physiography & Mountain Ranges';
    if (/national park|wildlife|tiger reserve|biosphere/.test(s)) return 'National Parks & Biosphere Reserves';
    if (/agriculture|crop|kharif|rabi|minerals|mines|industry/.test(s)) return 'Agriculture, Crops & Mineral Resources';
    if (/solar system|planet|earth|rotation|volcano|ocean|currents/.test(s)) return 'Physical & World Geography';
    return 'General Indian Geography';
  }

  if (/economics/i.test(top) || /banking/i.test(top)) {
    if (/rbi|repo rate|monetary policy|bank rate|inflation|money supply/.test(s)) return 'Banking & Monetary Policy';
    if (/budget|fiscal|tax|direct tax|gst|revenue/.test(s)) return 'Fiscal Policy, Budget & Taxation';
    if (/gdp|gnp|national income|per capita|five year plan/.test(s)) return 'National Income & Five Year Plans';
    if (/demand|supply|market|elasticity|monopoly/.test(s)) return 'Microeconomics & Markets';
    if (/scheme|pmay|yojana|portal|subsid/.test(s)) return 'Government Economic Schemes';
    return 'General Economics & Finance';
  }

  if (/science|biology|chemistry|physics/i.test(top)) {
    if (/cell|mitochondria|dna|rna|tissue|plant|photosynthesis/.test(s)) return 'Cell Biology & Plant Physiology';
    if (/disease|vitamin|deficiency|nutrition|hormone|organ|blood/.test(s)) return 'Human Body, Diseases & Vitamins';
    if (/acid|base|metal|non metal|periodic table|chemical reaction/.test(s)) return 'Acids, Bases, Metals & Periodic Table';
    if (/compound|polymer|gas|bonding|atom|atomic structure/.test(s)) return 'Atoms, Compounds & Materials';
    if (/newton|force|motion|gravitation|work|energy|power/.test(s)) return 'Mechanics, Force & Motion';
    if (/light|reflection|refraction|lens|mirror|sound|wave/.test(s)) return 'Optics, Sound & Waves';
    if (/electricity|current|voltage|resistance|magnetism/.test(s)) return 'Electricity & Magnetism';
    return 'General Science Principles';
  }

  if (/static\s*gk/i.test(top) || /dances?/i.test(top) || /music/i.test(top) || /culture/i.test(top) || /awards?/i.test(top) || /sports?/i.test(top)) {
    if (/dance|kathak|bharatanatyam|folk dance|classical dance/.test(s)) return 'Classical & Folk Dances';
    if (/instrument|sitar|tabla|shehnai|music|gharana|vocal/.test(s)) return 'Musical Instruments & Gharanas';
    if (/festival|fair|mela|harvest/.test(s)) return 'Festivals & Fairs of India';
    if (/award|bharat ratna|padma|nobel|sahitya akademi|khel ratna/.test(s)) return 'National & International Awards';
    if (/sport|olympic|cricket|trophy|cup|games|badminton/.test(s)) return 'Sports, Cups & Trophies';
    if (/book|author|novel|autobiography|written by/.test(s)) return 'Books & Authors';
    if (/temple|monument|heritage|unesco|caves/.test(s)) return 'Temples, Monuments & Heritage';
    return 'Important Days, Orgs & Static Facts';
  }

  if (/current\s*affairs/i.test(top) || /government\s*schemes/i.test(top)) {
    if (/scheme|yojana|portal|initiative|mission|pm/.test(s)) return 'Government Schemes & Policies';
    if (/summit|conference|cop|g20|brics|asean|bilateral/.test(s)) return 'International Summits & Treaties';
    if (/appointment|resignation|chief justice|ceo|ambassador/.test(s)) return 'Appointments & Resignations';
    if (/defence|exercise|missile|navy|army|air force|aircraft/.test(s)) return 'Defence & Military Exercises';
    if (/index|ranking|report|world happiness|hdi/.test(s)) return 'Reports, Indices & Rankings';
    if (/award|honour|sports event|champion/.test(s)) return 'Sports & Awards in News';
    return 'National & Global Events';
  }

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC CONSOLIDATION FALLBACK
  // ══════════════════════════════════════════════════════════════════════
  if (sub && sub.length > 2) {
    // Title case the cleaned subtopic
    const words = sub.split(/\s+/).filter(w => !STOP_WORDS.has(w.toLowerCase()));
    if (words.length > 0) {
      return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return 'General Concepts';
}

/**
 * Groups questions under a chapter into at most maxSubtopics (default 7).
 * Caps the final number of subtopics to 7-8 and consolidates the rest under "Others".
 */
export function getConsolidatedSubtopicsForQuestions(
  topic: string,
  questions: Question[],
  maxSubtopics: number = 7
): Array<{ label: string; qs: Question[] }> {
  if (!questions || questions.length === 0) return [];

  const map = new Map<string, Question[]>();

  questions.forEach(q => {
    const raw = q.subtopic || (q as any).tags?.subtopic || q.conceptTested || (q as any).tags?.conceptTested || null;
    const extra = [q.conceptTested, (q as any).tags?.conceptTested, q.solution, (q as any).explanation].filter(Boolean).join(' ');
    const canonical = normalizeSubtopic(topic, raw, q.question, extra);
    if (!map.has(canonical)) {
      map.set(canonical, []);
    }
    map.get(canonical)!.push(q);
  });

  // Sort subtopics by question count descending
  const sorted = Array.from(map.entries())
    .map(([label, qs]) => ({ label, qs }))
    .sort((a, b) => b.qs.length - a.qs.length);

  // If already <= maxSubtopics, return directly
  if (sorted.length <= maxSubtopics) {
    return sorted;
  }

  // If more than maxSubtopics, keep top (maxSubtopics - 1) and combine remaining into "Others"
  const top = sorted.slice(0, maxSubtopics - 1);
  const rest = sorted.slice(maxSubtopics - 1);
  const othersQs = rest.flatMap(item => item.qs);

  return [...top, { label: 'Others', qs: othersQs }];
}
