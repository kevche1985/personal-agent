/**
 * Rule-based merchant → budget category classifier.
 * Covers major Canadian merchants, subscriptions, utilities, and generic patterns.
 * Returns { category, confidence, sub_tag? }
 * No AI required.
 */

// Each entry: [regex_or_string, category, confidence, optional_sub_tag]
// Evaluated top-to-bottom; first match wins.
const RULES = [
  // ─── Housing ──────────────────────────────────────────────────────────────
  [/rent|loyer|property\s*management|property\s*mgmt|realty|remax|century\s*21|keller\s*williams/i, 'Housing', 'high'],
  [/hydro[\s-]?(qu[eé]bec|one|ottawa|bc)?|ontario\s*hydro|nova\s*scotia\s*power|nb\s*power|newfoundland\s*power|fortis\s*bc/i, 'Housing', 'high'],
  [/\benbridge|\bpetrogas|\bnaturenergy|national\s*gas|gas\s*(metro|utility)|engie/i, 'Housing', 'high'],
  [/rogers|telus|bell\s*(canada|internet|mobility)?|shaw|videotron|eastlink|koodo|fido|public\s*mobile|freedom\s*mobile|virgin\s*mobile/i, 'Housing', 'medium'],
  [/internet|cable\s*tv|tv\s*plan|home\s*phone|telephone\s*residentiel/i, 'Housing', 'medium'],
  [/insurance\s*(home|renter|condo)|home\s*insurance|tenant\s*ins/i, 'Insurance', 'high'],

  // ─── Insurance ────────────────────────────────────────────────────────────
  [/intact|belairdirect|aviva|desjardins\s*assur|td\s*ins|rbc\s*ins|sunlife|manulife|great.west|canada\s*life|empire\s*life|equitable\s*life/i, 'Insurance', 'high'],
  [/insurance|assurance|life\s*ins|car\s*ins|auto\s*ins/i, 'Insurance', 'medium'],

  // ─── Transport ────────────────────────────────────────────────────────────
  [/\buber\b(?!\s*eats)/i, 'Transport', 'high'],
  [/\blyft\b|indriver|taxis?|taxify|bolt\s*ride/i, 'Transport', 'high'],
  [/presto|opus\s*card|transit|stm\s*montreal|oct\s*transpo|ttc|translink|calgary\s*transit|bus\s*pass|metro\s*pass/i, 'Transport', 'high'],
  [/via\s*rail|amtrak|greyhound|megabus|flixbus|coach\s*canada|orléans\s*express/i, 'Transport', 'high'],
  [/air\s*canada|westjet|porter\s*airlines|sunwing|transat|air\s*transat|flair\s*air/i, 'Transport', 'high'],
  [/\bshell\b|\besso\b|\bpetro.canada\b|\bpetrocan\b|\bcostco\s*gas\b|\bsunoco\b|\bhusky\b|\birving\s*oil\b|\bcircle\s*k\b(?=.*gas)/i, 'Transport', 'high'],
  [/\bparking\b|\bimpark\b|\bindigo\s*park\b|\bgreenp\b|\bsp\s*\+\b/i, 'Transport', 'medium'],
  [/car\s*rental|enterprise\s*rent|hertz|avis|budget\s*rent|national\s*car/i, 'Transport', 'high'],

  // ─── Food & Groceries ─────────────────────────────────────────────────────
  [/loblaws|no\s*frills|zehrs|independent\s*grocer|valu.mart|superstore|atlantic\s*superstore/i, 'Food & Groceries', 'high'],
  [/metro\s*(inc|grocery|\bon\b)?|iga\b|sobeys|safeway|thrifty\s*foods|freshco|food\s*basics|walmart\s*(grocery|supercentre)/i, 'Food & Groceries', 'high'],
  [/costco\b(?!\s*gas)|whole\s*foods|farm\s*boy|highland\s*farms|marché\s*taïga|avril|rachelle.b[eé]ry/i, 'Food & Groceries', 'high'],
  [/dollarama(?!\s*hair)|dollar\s*tree|five\s*below/i, 'Food & Groceries', 'medium'],
  [/tim\s*horton|timmies|mcdonald|mcdo\b|burger\s*king|wendy'?s|harveys|a&w|dairy\s*queen|popeyes|kfc|swiss\s*chalet|moxie|boston\s*pizza/i, 'Food & Groceries', 'high'],
  [/starbucks|second\s*cup|van\s*houtte|williams\s*coffee|country\s*style|cafe\s*(ne[ro]|bar|lounge)/i, 'Food & Groceries', 'high'],
  [/uber\s*eats|doordash|skip\s*the\s*dishes|skipthedishes|instacart|delivery|deliveroo|grubhub|fantuan/i, 'Food & Groceries', 'high'],
  [/subway\b|panera|chipotle|five\s*guys|freshii|qdoba|taco\s*bell|pita\s*pit|mr\s*sub|quiznos/i, 'Food & Groceries', 'high'],
  [/sushi|ramen|pho\b|noodle|dim\s*sum|boulanger(ie)?|boulangerie|pâtisserie|bakery|patisserie/i, 'Food & Groceries', 'medium'],
  [/restaurant|bistro|brasserie|eatery|grill|taverne|tavern|pub\b|bar\s*&\s*grill|lounge\b|pizzeria|pizza/i, 'Food & Groceries', 'medium'],

  // ─── Health ───────────────────────────────────────────────────────────────
  [/shoppers\s*drug|pharmaprix|jean\s*coutu|rexall|proxim|uniprix|brunet|lawtons|london\s*drugs/i, 'Health', 'high'],
  [/pharmacy|pharmacie|drug\s*mart|guardian\s*pharma/i, 'Health', 'high'],
  [/goodlife|anytime\s*fitness|ymca|ywca|planet\s*fitness|equinox|orange\s*theory|f45|crunch\s*fitness|la\s*fitness|snap\s*fitness/i, 'Health', 'high'],
  [/dental|dentist|optometr|vision\s*care|eyegl|eye\s*care|contact\s*lens|glasses\b|lunetterie/i, 'Health', 'high'],
  [/physio|physiotherapy|chiropractic|massage\s*therapy|acupuncture|naturopath/i, 'Health', 'high'],
  [/medisys|dynacare|lifelabs|alpha\s*labs|dr\b\.|clinic|medical\s*center|centre\s*m[eé]dical|walk.in\s*clinic/i, 'Health', 'medium'],

  // ─── Subscriptions ────────────────────────────────────────────────────────
  // Streaming
  [/netflix/i, 'Subscriptions', 'high', 'streaming'],
  [/disney\s*\+?|disneyplus/i, 'Subscriptions', 'high', 'streaming'],
  [/crave\s*(tv)?|craveable/i, 'Subscriptions', 'high', 'streaming'],
  [/amazon\s*prime|prime\s*video/i, 'Subscriptions', 'high', 'streaming'],
  [/apple\s*tv\+?|apple\s*one/i, 'Subscriptions', 'high', 'streaming'],
  [/paramount\+?/i, 'Subscriptions', 'high', 'streaming'],
  [/hulu\b|peacock\s*tv|hbo\s*max|max\b(?=.*stream)/i, 'Subscriptions', 'high', 'streaming'],
  [/spotify|apple\s*music|tidal\b|deezer|youtube\s*music|amazon\s*music/i, 'Subscriptions', 'high', 'streaming'],
  [/youtube\s*premium|google\s*one|google\s*play\s*(pass|sub)/i, 'Subscriptions', 'high', 'software'],
  // Software/SaaS
  [/microsoft\s*(365|office|sub)|office\s*365|ms365/i, 'Subscriptions', 'high', 'software'],
  [/adobe\b|acrobat\s*(pro|sub)/i, 'Subscriptions', 'high', 'software'],
  [/github\b|gitlab\b|bitbucket/i, 'Subscriptions', 'high', 'software'],
  [/openai\b|chatgpt|anthropic\b|midjourney\b|notion\s*ai/i, 'Subscriptions', 'high', 'software'],
  [/1password|lastpass|dashlane|bitwarden\s*premium/i, 'Subscriptions', 'high', 'software'],
  [/notion\b|airtable|monday\.com|asana|trello/i, 'Subscriptions', 'high', 'software'],
  [/slack\b|zoom\b|teams\b(?=.*microsoft)/i, 'Subscriptions', 'high', 'software'],
  [/dropbox|box\.com|icloud|onedrive|google\s*(drive|storage)\b/i, 'Subscriptions', 'high', 'software'],
  // Fitness
  [/peloton|strava\s*sub|nike\s*training\s*club/i, 'Subscriptions', 'high', 'fitness'],
  // News
  [/new\s*york\s*times\b|nyt\b|the\s*globe\b|globe\s*and\s*mail|toronto\s*star\b|le\s*devoir|la\s*presse\+/i, 'Subscriptions', 'high', 'news'],
  [/the\s*athletic\b|wsj\b|wall\s*street\s*journal|financial\s*times\b|economist\b/i, 'Subscriptions', 'high', 'news'],

  // ─── Entertainment ────────────────────────────────────────────────────────
  [/cineplex|landmark\s*cinema|cinéma|theatre|theater\b/i, 'Entertainment', 'high'],
  [/event\s*brite|ticketmaster|stubhub|seatgeek|livenation|live\s*nation/i, 'Entertainment', 'high'],
  [/steam\b|epic\s*games|playstation|xbox\s*(game\s*pass)?|nintendo\s*eshop|battle\.net|ubisoft/i, 'Entertainment', 'high'],
  [/chapters|indigo\b|amazon\b(?=.*book)|kobo\b|kindle\b(?=.*book)/i, 'Entertainment', 'medium'],
  [/museum|galerie|gallery|zoo\b|aquarium|parc\s*(olympique|lafontaine)/i, 'Entertainment', 'medium'],

  // ─── Education ────────────────────────────────────────────────────────────
  [/coursera|udemy|skillshare|linkedIn\s*learn|pluralsight|edx\b|duolingo\s*(plus|sub)/i, 'Education', 'high'],
  [/mcgill|university|université|college|cegep|école|school\s*(board|fee)|tuition/i, 'Education', 'high'],
  [/student\s*(loan|line|osap)|nslsc\b/i, 'Education', 'high'],
  [/staples|bureau.en.gros|bureau\s*en\s*gros/i, 'Education', 'medium'],

  // ─── Remittances ──────────────────────────────────────────────────────────
  [/western\s*union|moneygram|wise\b|remitly|sendwave|xoom\b|paysend|instarem|transfer\s*go/i, 'Remittances', 'high'],
  [/international\s*transfer|wire\s*transfer|virement\s*int/i, 'Remittances', 'medium'],

  // ─── Debt Payments ────────────────────────────────────────────────────────
  [/visa\s*payment|mastercard\s*payment|amex\s*payment|card\s*payment|credit\s*card\s*payment|remb\.?\s*carte/i, 'Debt Payments', 'high'],
  [/loan\s*payment|mortgage\s*payment|pret\s*hypo|car\s*loan|auto\s*loan|student\s*loan\s*pay/i, 'Debt Payments', 'high'],
  [/consolidation|creditor|collection|receiver\s*general/i, 'Debt Payments', 'medium'],

  // ─── Savings / Investments ────────────────────────────────────────────────
  [/questrade|wealthsimple|rbc\s*(invest|direct)|td\s*(invest|waterhouse)|cibc\s*invest|nbdb\b|disnat\b|desjardins\s*(courtage|invest)/i, 'Savings', 'high'],
  [/\btfsa\b|\brrsp\b|\bfhsa\b|\bresp\b|\brrif\b|investissement|investment\s*transfer/i, 'Savings', 'high'],
  [/e.transfer\s*(savings|tfsa|rrsp)/i, 'Savings', 'medium'],

  // ─── Bank / Financial fees (usually Other or Debt) ───────────────────────
  [/service\s*charge|bank\s*fee|frais\s*bancaire|nsf\s*fee|overdraft|interest\s*charge|annual\s*fee/i, 'Other', 'high'],
  [/e.?transfer\b|interac/i, 'Other', 'medium'],
];

/**
 * Classify a merchant name into a budget category.
 * @param {string} merchant
 * @returns {{ category: string, confidence: 'high'|'medium'|'low', sub_tag?: string }}
 */
export function classifyMerchant(merchant) {
  const s = String(merchant || '').trim();
  for (const [pattern, category, confidence, sub_tag] of RULES) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    if (re.test(s)) {
      return { category, confidence, ...(sub_tag ? { sub_tag } : {}) };
    }
  }
  return { category: 'Other', confidence: 'low' };
}

/**
 * Classify an array of transaction objects in-place.
 * @param {Array<{merchant: string}>} transactions
 * @returns {Array} same array with category/confidence/sub_tag fields added
 */
export function classifyTransactions(transactions) {
  return transactions.map((t) => {
    const result = classifyMerchant(t.merchant);
    return { ...t, ...result };
  });
}
