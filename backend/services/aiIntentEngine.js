const { parseDateExpression } = require('../utils/dateParser');

const CATEGORY_ALIASES = {
  'food': 'Food & Dining', 'dining': 'Food & Dining', 'restaurant': 'Food & Dining', 'groceries': 'Food & Dining', 'grocery': 'Food & Dining', 'lunch': 'Food & Dining', 'dinner': 'Food & Dining', 'breakfast': 'Food & Dining', 'snack': 'Food & Dining', 'tea': 'Food & Dining', 'coffee': 'Food & Dining',
  'shopping': 'Shopping', 'electronics': 'Shopping', 'clothing': 'Shopping', 'fashion': 'Shopping', 'clothes': 'Shopping', 'shoes': 'Shopping',
  'bills': 'Bills & Utilities', 'utilities': 'Bills & Utilities', 'electricity': 'Bills & Utilities', 'water': 'Bills & Utilities', 'gas': 'Bills & Utilities', 'internet': 'Bills & Utilities', 'phone': 'Bills & Utilities', 'mobile': 'Bills & Utilities', 'broadband': 'Bills & Utilities', 'dth': 'Bills & Utilities', 'recharge': 'Bills & Utilities',
  'transport': 'Transport', 'transportation': 'Transport', 'fuel': 'Transport', 'petrol': 'Transport', 'diesel': 'Transport', 'cab': 'Transport', 'taxi': 'Transport', 'uber': 'Transport', 'ola': 'Transport', 'parking': 'Transport', 'metro': 'Transport', 'bus': 'Transport', 'auto': 'Transport', 'railway': 'Transport', 'train': 'Transport', 'flight': 'Transport',
  'healthcare': 'Healthcare', 'medical': 'Healthcare', 'health': 'Healthcare', 'doctor': 'Healthcare', 'hospital': 'Healthcare', 'pharmacy': 'Healthcare', 'medicine': 'Healthcare', 'clinic': 'Healthcare',
  'entertainment': 'Entertainment', 'movies': 'Entertainment', 'gaming': 'Entertainment', 'sports': 'Entertainment', 'streaming': 'Entertainment', 'netflix': 'Entertainment', 'spotify': 'Entertainment', 'hotstar': 'Entertainment', 'party': 'Entertainment',
  'education': 'Education', 'course': 'Education', 'learning': 'Education', 'books': 'Education', 'fees': 'Education', 'tuition': 'Education', 'training': 'Education', 'certification': 'Education',
  'rent': 'Rent', 'housing': 'Rent', 'emi': 'Rent', 'mortgage': 'Rent', 'lease': 'Rent',
  'travel': 'Travel', 'vacation': 'Travel', 'trip': 'Travel', 'hotel': 'Travel', 'booking': 'Travel', 'holiday': 'Travel', 'tour': 'Travel', 'airbnb': 'Travel',
  'subscriptions': 'Subscriptions', 'subscription': 'Subscriptions', 'memberships': 'Subscriptions', 'membership': 'Subscriptions',
  'personal care': 'Personal Care', 'grooming': 'Personal Care', 'salon': 'Personal Care', 'gym': 'Personal Care', 'fitness': 'Personal Care', 'spa': 'Personal Care',
  'gifts': 'Gifts', 'donations': 'Gifts', 'charity': 'Gifts', 'donation': 'Gifts',
  'insurance': 'Insurance', 'premium': 'Insurance',
  'taxes': 'Taxes', 'tax': 'Taxes',
};

const GOAL_ALIASES = {
  'emergency fund': 'Emergency Fund', 'emergency': 'Emergency Fund', 'rainy day': 'Emergency Fund', 'emergency savings': 'Emergency Fund',
  'car purchase': 'Car Purchase', 'car': 'Car Purchase', 'vehicle': 'Car Purchase', 'bike': 'Car Purchase', 'motorcycle': 'Car Purchase', 'suv': 'Car Purchase',
  'vacation': 'Vacation', 'trip': 'Vacation', 'travel': 'Vacation', 'holiday': 'Vacation', 'tour': 'Vacation', 'getaway': 'Vacation',
  'higher education': 'Higher Education', 'education': 'Higher Education', 'masters': 'Higher Education', 'mba': 'Higher Education', 'college': 'Higher Education', 'university': 'Higher Education', 'study abroad': 'Higher Education',
  'wedding': 'Wedding', 'marriage': 'Wedding',
  'home purchase': 'Home Purchase', 'house': 'Home Purchase', 'home': 'Home Purchase', 'flat': 'Home Purchase', 'apartment': 'Home Purchase', 'villa': 'Home Purchase',
  'retirement': 'Retirement', 'pension': 'Retirement', 'retirement fund': 'Retirement',
  'new phone': 'New Phone', 'phone': 'New Phone', 'laptop': 'New Phone', 'gadget': 'New Phone', 'macbook': 'New Phone', 'iphone': 'New Phone',
  'down payment': 'Down Payment',
  'wealth building': 'Wealth Building', 'wealth': 'Wealth Building', 'net worth': 'Wealth Building',
};

const INVESTMENT_ALIASES = {
  'stock': 'Stocks', 'stocks': 'Stocks', 'equity': 'Stocks', 'shares': 'Stocks', 'share': 'Stocks', 'nifty': 'Stocks', 'sensex': 'Stocks',
  'mutual fund': 'Mutual Funds', 'mutual funds': 'Mutual Funds', 'mf': 'Mutual Funds', 'sip': 'Mutual Funds', 'sip\'s': 'Mutual Funds',
  'fixed deposit': 'Fixed Deposit', 'fd': 'Fixed Deposit', 'term deposit': 'Fixed Deposit', 'fds': 'Fixed Deposit',
  'ppf': 'PPF', 'public provident fund': 'PPF',
  'nps': 'NPS', 'national pension system': 'NPS',
  'crypto': 'Crypto', 'cryptocurrency': 'Crypto', 'bitcoin': 'Crypto', 'ethereum': 'Crypto', 'btc': 'Crypto', 'eth': 'Crypto', 'altcoin': 'Crypto',
  'gold': 'Gold', 'sovereign gold bond': 'Gold', 'sgb': 'Gold', 'gold etf': 'Gold',
  'real estate': 'Real Estate', 'property': 'Real Estate', 'reit': 'Real Estate',
  'bonds': 'Bonds', 'bond': 'Bonds', 'government bond': 'Bonds', 'debenture': 'Bonds',
  'etf': 'ETF', 'exchange traded fund': 'ETF', 'index fund': 'ETF',
};

function extractCategory(query) {
  const q = query.toLowerCase();
  const sorted = Object.entries(CATEGORY_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sorted) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) return canonical;
  }
  return null;
}

function extractAllCategories(query) {
  const q = query.toLowerCase();
  const found = [];
  const sorted = Object.entries(CATEGORY_ALIASES).sort((a, b) => b[0].length - a[0].length);
  const seen = new Set();
  for (const [alias, canonical] of sorted) {
    if (seen.has(canonical)) continue;
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }
  return found;
}

function extractGoalName(query) {
  const q = query.toLowerCase();
  const sorted = Object.entries(GOAL_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sorted) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) return canonical;
  }
  return null;
}

function extractInvestmentType(query) {
  const q = query.toLowerCase();
  const sorted = Object.entries(INVESTMENT_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sorted) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) return canonical;
  }
  return null;
}

function extractAmount(query) {
  const patterns = [
    /(?:₹|inr|rs\.?|rupees?)\s*(\d[\d,]*\.?\d*)/i,
    /(\d[\d,]*\.?\d*)\s*(?:₹|inr|rs\.?|rupees?)/i,
    /(?:\$|usd|dollars?)\s*(\d[\d,]*\.?\d*)/i,
    /(\d[\d,]*\.?\d*)\s*(?:\$|usd|dollars?)/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return parseFloat(match[1].replace(/,/g, ''));
  }
  const plainNum = query.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/);
  if (plainNum && parseInt(plainNum[1].replace(/,/g, ''), 10) > 100) {
    return parseFloat(plainNum[1].replace(/,/g, ''));
  }
  return null;
}

const SENTIMENT_PATTERNS = {
  worried: /\b(?:worried|concerned|anxious|nervous|scared|afraid|panic|stressed|tense|uneasy)\b/,
  frustrated: /\b(?:frustrated|annoyed|irritated|angry|mad|furious|upset|disappointed)\b/,
  happy: /\b(?:happy|great|awesome|amazing|wonderful|excellent|fantastic|good|nice|glad|pleased|satisfied)\b/,
  curious: /\b(?:curious|wonder|question|query|doubt|confused|unsure|uncertain)\b/,
  hopeful: /\b(?:hope|wish|want|plan|aim|target|goal|achieve|reach|future)\b/,
};

const COMPARISON_PATTERNS = /\b(?:compare|comparison|vs|versus|against|difference|change|trend|changed|compare\s+with|compared|how\s+(?:has|did).*change|over\s+time|last\s+month|previous|before|then\s+vs|then\s+versus)\b/i;
const HIGHEST_PATTERNS = /\b(?:highest|top|biggest|largest|most|maximum|max|biggest|heaviest|heaviest)\b/i;
const LOWEST_PATTERNS = /\b(?:lowest|smallest|least|minimal|minimum|min|tiny|little)\b/i;
const BEST_PATTERNS = /\b(?:best|best\s+performing|highest\s+return|top\s+performer|outperform|strongest)\b/i;
const WORST_PATTERNS = /\b(?:worst|worst\s+performing|lowest\s+return|underperform|weakest|poorest|losing)\b/i;
const REMAINING_PATTERNS = /\b(?:remain|remaining|left|leftover|available|still|pending|balance)\b/i;
const OVERSPENT_PATTERNS = /\b(?:exceed|exceeded|over|overspent|overbudget|over\s+budget|crossed|breach|gone\s+over|exceeding)\b/i;
const ALL_PATTERNS = /\b(?:all|every|each|entire|list\s+all|show\s+all|complete|full|entire)\b/i;

const INTENT_KEYWORD_MAP = {
  greeting: {
    patterns: [
      /^(?:hi|hello!*|hey!*)\s*[!. ]*$/i,
      /^(?:hi|hello|hey|howdy|greetings|good\s+(?:morning|afternoon|evening)|sup|yo|hola|namaste|namaskar)[!. ]*$/i,
    ],
    keywords: [],
    weight: 25,
  },
  farewell: {
    patterns: [
      /^(?:bye|goodbye|see\s+you|see\s+ya|take\s+care|ttyl|cya|good\s+night|gn|night|sleep\s+well)[!. ]*$/i,
    ],
    keywords: [],
    weight: 25,
  },
  thanks: {
    patterns: [
      /^(?:thanks|thank\s*you|thankyou|ty|thx|tysm|thank\s+you\s+so\s+much|appreciate|cheers)[!. ]*$/i,
    ],
    keywords: [],
    weight: 25,
  },
  expense_summary: {
    patterns: [
      /\b(?:how\s+much\s+(?:did\s+)?(?:i|we)\s+(?:spend|spent|expend|use|used|blow|burn))\b/,
      /\b(?:spend|spent|expense|expenses|expenditure|spending|costs?|billing|bill)\b.*\b(?:month|week|today|yesterday|year|total|overall|last|this|previous)\b/,
      /\b(?:month|week|today|yesterday|year|total|overall|last|this|previous)\b.*\b(?:spend|spent|expense|expenses|expenditure|spending|costs?)\b/,
      /\b(?:total|overall|aggregate)\s+(?:spending|expense|expenditure|cost)\b/,
      /\b(?:show|give|get|tell|see|view|display|check|pull|fetch)\b.*\b(?:expense|spending|expenditure|cost)\b/,
      /\b(?:expense|spending|expenditure)\s+(?:summary|overview|breakdown|report|analysis|detail|list)\b/,
      /\b(?:what\s+(?:did\s+)?(?:i|we)\s+spend)\b/,
      /\b(?:what\s+was\s+(?:my|our)\s+spending)\b/,
      /\b(?:where\s+(?:did\s+)?(?:i|we)\s+(?:spend|go))\b/,
      /\b(?:money\s+(?:spent|going|flowing|out|where))\b/,
      /\b(?:spending)\s+(?:in|for|during)\b/,
      /\b(?:where\s+(?:did|does)\s+(?:all\s+)?(?:my|the|our)\s+money\s+go)\b/,
      /\b(?:what\s+did\s+i\s+buy)\b/,
      /\b(?:receipt|transaction|purchase)\b/,
    ],
    keywords: ['spend', 'spent', 'expense', 'expenses', 'spending', 'cost', 'costs', 'bought', 'buy', 'purchase', 'payment', 'paid', 'bill', 'bills'],
    weight: 10,
  },
  expense_category: {
    patterns: [
      /\b(?:which|what)\s+(?:category|categories)\b/,
      /\b(?:highest|top|biggest|largest|most|maximum)\s+(?:expense|spending|category|cost|expenditure)\b/,
      /\b(?:lowest|smallest|least|minimum)\b.*\b(?:category|expense|spending)\b/,
      /\b(?:category|categories)\s+(?:expense|spending|breakdown|analysis|wise|distribution)\b/,
      /\b(?:break\s?down|split|segregate)\b.*\b(?:expense|spending|cost)\b/,
      /\b(?:expense|spending)\s+(?:by\s+)?category\b/,
      /\b(?:how\s+much\s+(?:did\s+)?(?:i|we)\s+spend\s+on)\b/,
      /\b(?:spent\s+on)\b/,
      /\b(?:spend(?:ing)?|cost|expense)\s+(?:on|for)\s+(?:food|shopping|bills|transport|healthcare|entertainment|education|rent|travel|subscriptions)\b/,
    ],
    keywords: ['category', 'categories', 'breakdown', 'split', 'segregate', 'which', 'where most', 'where least'],
    weight: 10,
  },
  budget_status: {
    patterns: [
      /\b(?:budget|budgets)\s+(?:status|report|overview|health|check|utilization|usage)\b/,
      /\b(?:status|report|overview|health|check)\b.*\b(?:budget|budgets)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:exceed|overspend|over\s+budget|under\s+budget|within\s+budget)\b/,
      /\b(?:exceed|exceeded|overspend|overspent|over\s+spend)\b.*\b(?:budget|limit)\b/,
      /\b(?:budget)\b.*\b(?:exceed|exceeded|over|remain|left|remaining|used|utilized)\b/,
      /\b(?:remain|left|leftover|available)\b.*\b(?:budget|money|amount)\b/,
      /\b(?:which|what)\s+(?:budget|category)\s+(?:closest|nearing|near|limit|exceeded|over)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:budget|budgets)\b/,
      /\b(?:how\s+much\s+(?:budget|money)\s+is\s+remaining)\b/,
      /\b(?:budget)\s+(?:remaining|left|utilized|spent|used)\b/,
      /\b(?:am\s+(?:i|we)\s+(?:over|exceeding|exceed|overbudget))\b/,
      /\b(?:spending)\s+(?:over|above|beyond|more\s+than)\b/,
      /\b(?:on\s+track|tracking|doing)\b.*\b(?:budget|spending)\b/,
    ],
    keywords: ['budget', 'budgets', 'limit', 'allocated', 'allocation', 'utilize', 'utilization'],
    weight: 10,
  },
  savings_analysis: {
    patterns: [
      /\b(?:savings?\s+rate|saving\s+rate)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:saving|save)\s+enough\b/,
      /\b(?:improve|increase|boost|better)\s+(?:my|our)\s+(?:savings?|saving\s+rate)\b/,
      /\b(?:can\s+(?:i|we)\s+)?(?:save|saving)\s+(?:\d|₹|\$|£|€|inr|usd|gbp|eur)\b/,
      /\b(?:how\s+much\s+(?:should|can|do)\s+(?:i|we)\s+save)\b/,
      /\b(?:savings?|saved|saving)\b.*\b(?:enough|sufficient|adequate|goal|target|goal|plan)\b/,
      /\b(?:reduce|cut|lower)\s+(?:spending|expense|expenses|cost)\b/,
      /\b(?:what\s+percentage\s+of\s+(?:my|our)\s+income\s+am\s+(?:i|we)\s+saving)\b/,
      /\b(?:show\s+(?:my|our)\s+savings\s+(?:rate|percentage|percent))\b/,
      /\b(?:how\s+much\s+am\s+(?:i|we)\s+saving)\b/,
      /\b(?:savings?|saved|saving)\b.*\b(?:rate|percentage|percent|ratio)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:saving|save)\b/,
      /\b(?:can\s+i\s+save)\b/,
    ],
    keywords: ['save', 'saving', 'savings', 'saved', 'savings rate', 'save money'],
    weight: 10,
  },
  investment_performance: {
    patterns: [
      /\b(?:investments?|portfolio|mutual\s+funds?|stocks?|shares?|etf|crypto|gold|bonds?|fd|ppf|nps)\b.*\b(?:perform|doing|performance|return|returns|grow|growth|profit|loss|value|analysis|review)\b/,
      /\b(?:perform|doing|performance|return|returns|grow|growth|profit|loss|value|analysis)\b.*\b(?:investments?|portfolio|mutual\s+funds?|stocks?|shares?|etf|crypto|gold|bonds?|fd|ppf|nps)\b/,
      /\b(?:which|what)\s+(?:investments?|investment|stock|mutual\s+fund|fund|etf|asset)\s+(?:is|are)\s+(?:best|worst|performing|growing|doing)\b/,
      /\b(?:best|worst|top|highest|lowest|underperform)\b.*\b(?:invest|investment|stock|fund|asset|return|roi)\b/,
      /\b(?:total|overall|combined)\s+(?:portfolio|investment|invested|value|returns?|profit|loss)\b/,
      /\b(?:portfolio|investments?|investing)\s+(?:value|worth|total|summary|overview|allocation|distribution)\b/,
      /\b(?:how\s+(?:are|is|do|did|will)\s+(?:my|our|the)\s+)?(?:investments?|portfolio|mutual\s+funds?|stocks?)\s+(?:performing|doing|growing|going|looking)\b/,
      /\b(?:how\s+much\s+(?:profit|loss|money|return))\s+(?:have\s+)?(?:i|we)\s+(?:made|earned|got|lost|have)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:invest|investment|portfolio)\b/,
      /\b(?:invest|invested|investment|investing)\b.*\b(?:total|amount|overall|summary|overview)\b/,
      /\b(?:review|revisit|reassess)\b.*\b(?:invest|investment|portfolio)\b/,
      /\b(?:portfolio|invest)\w*\s+(?:return|returns|profit|loss|gain|growth)\b/,
    ],
    keywords: ['invest', 'investment', 'investments', 'portfolio', 'mutual fund', 'stocks', 'returns', 'roi', 'profit', 'loss', 'etf', 'crypto', 'gold', 'bonds', 'fd', 'ppf', 'nps', 'sip'],
    weight: 10,
  },
  goal_progress: {
    patterns: [
      /\b(?:goals?|targets?|milestones?)\s+(?:progress|status|track|tracking|update|overview|report|plan|planning)\b/,
      /\b(?:progress|status|track|tracking|update|overview|report)\b.*\b(?:goals?|targets?|milestones?)\b/,
      /\b(?:how\s+(?:close|far|much))\s+(?:am\s+(?:i|we)\s+)?(?:to|from|toward)\b.*\b(?:goal|target|milestone|fund)\b/,
      /\b(?:emergency\s+fund|car\s+purchase|vacation|higher\s+education|wedding|home|retirement|phone|laptop)\b.*\b(?:progress|status|close|remaining|complete|done|achieve)\b/,
      /\b(?:how\s+much\s+is\s+remaining)\b/,
      /\b(?:remaining)\b.*\b(?:goal|fund|target|for)\b/,
      /\b(?:when\s+(?:will|shall|can)\s+(?:i|we)\s+(?:complete|finish|achieve|reach|meet))\b/,
      /\b(?:how\s+much\s+should\s+(?:i|we)\s+save\s+monthly)\b/,
      /\b(?:which|what)\s+(?:goals?|targets?)\s+(?:are|is)\s+(?:overdue|behind|ahead|achieved|done|completed|active|paused)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:goals?|targets?)\b/,
      /\b(?:goals?|targets?)\b.*\b(?:achieve|complete|finish|reach|meet|done)\b/,
      /\b(?:how\s+close\s+am\s+i)\b/,
    ],
    keywords: ['goal', 'goals', 'target', 'targets', 'milestone', 'emergency fund', 'achieve', 'complete', 'progress'],
    weight: 10,
  },
  financial_report: {
    patterns: [
      /\b(?:report|reports|summaries)\b/,
      /\b(?:generate|create|show|give|get|send|produce)\b.*\b(?:report|summary|analytics|analysis|insights)\b/,
      /\b(?:monthly|weekly|daily|yearly|annual|quarterly)\s+(?:report|summary|analysis|review)\b/,
      /\b(?:income\s+vs\s+expense|expense\s+vs\s+income|income\s+versus|expense\s+versus)\b/,
      /\b(?:trends?|patterns?|habits?|tendencies?)\b.*\b(?:finance|financial|spending|money|expense|income)\b/,
      /\b(?:where\s+am\s+(?:i|we)\s+wasting)\b/,
      /\b(?:wasting|waste)\s+(?:money|most)\b/,
      /\b(?:spending\s+patterns?|spending\s+trends?|spending\s+habits?)\b/,
      /\b(?:money\s+flow|cash\s+flow|cashflow)\b/,
      /\b(?:financial\s+summary|complete\s+summary|full\s+summary)\b/,
      /\b(?:compare\s+(?:my\s+)?(?:income|expense|spending)\s+(?:with|to|vs|versus))\b/,
      /\b(?:compare|comparison|vs|versus|against)\b.*\b(?:expense|spending|month|category)\b/,
      /\b(?:give\s+(?:me\s+)?(?:a\s+)?(?:complete|full|detailed)\s+(?:financial|money)\s+report)\b/,
      /\b(?:complete|full)\s+(?:financial|money)\s+report\b/,
      /\b(?:complete\s+analysis|full\s+analysis|comprehensive|overview\s+of\s+my\s+finances)\b/,
      /\b(?:analyze\s+(?:my\s+)?(?:finances?|financial|money|spending))\b/,
      /\b(?:where\s+(?:am|i|do)\s+(?:i|we)\s+wasting)\b/,
    ],
    keywords: ['report', 'summary', 'analysis', 'insights', 'trend', 'pattern', 'habits', 'wasting', 'cash flow', 'overview'],
    weight: 9,
  },
  advice: {
    patterns: [
      /\b(?:what\s+should\s+(?:i|we)\s+(?:do|improve|change|cut|reduce|increase|start|stop|focus))\b/,
      /\b(?:help\s+(?:me|us)\s+(?:manage|improve|handle|plan|organize|track))\b/,
      /\b(?:personalized\s+)?(?:advice|suggestion|recommendation|tip|guidance)\b/,
      /\b(?:advice|suggest|recommend|tips?|guidance)\s+(?:on|for|about)\s+(?:finance|financial|money|saving|budget|invest|spending)\b/,
      /\b(?:plan\s+(?:my|our)\s+(?:savings?|money|finances?|budget))\b/,
      /\b(?:spending\s+too\s+much)\b/,
      /\b(?:what\s+can\s+(?:i|we)\s+do\s+(?:to|about))\b/,
      /\b(?:how\s+(?:can|do)\s+(?:i|we)\s+(?:improve|save|reduce|cut|invest|manage|plan|better))\b/,
      /\b(?:think\s+(?:i|we)\s+(?:am|are)\s+spending)\b/,
      /\b(?:i(?:'m|\s+am)\s+spending\s+too\s+much)\b/,
      /\b(?:what\s+should\s+i\s+improve\s+financially)\b/,
      /\b(?:can\s+(?:you|i|we)\s+)?(?:suggest|recommend)\b/,
      /\b(?:what\s+do\s+(?:you|i)\s+think)\b/,
      /\b(?:help\s+me\s+manage\s+my\s+money)\b/,
      /\b(?:how\s+do\s+(?:i|we)\s+(?:get|become)\s+(?:rich|wealthy|financially\s+free))\b/,
      /\b(?:what\s+am\s+i\s+doing\s+wrong)\b/,
      /\b(?:how\s+(?:can|do)\s+i\s+(?:better|improve))\b/,
    ],
    keywords: ['advice', 'suggest', 'recommend', 'improve', 'manage', 'plan', 'better', 'wrong', 'help me'],
    weight: 9,
  },
  financial_health: {
    patterns: [
      /\b(?:financial\s+health|health\s+score|money\s+health|financial\s+score|health\s+check)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:doing|doing\s+well|on\s+track|financially\s+(?:stable|secure|healthy|strong))\b/,
      /\b(?:how\s+(?:is|are|do)\s+(?:my|our)\s+(?:finances?|financial|money|finance))\b/,
      /\b(?:overall\s+(?:health|score|rating|grade|status))\b/,
      /\b(?:improve|increase|boost|better|fix)\s+(?:my|our)\s+(?:financial|finance|money|financial\s+health)\b/,
      /\b(?:my\s+financial|financial\s+status|financial\s+overview)\b/,
      /\b(?:is\s+my\s+savings\s+rate\s+good)\b/,
      /\b(?:am\s+i\s+(?:financially\s+)?(?:healthy|stable|secure|strong))\b/,
      /\b(?:how\s+(?:good|bad|healthy)\s+(?:is|are)\s+my\s+finances)\b/,
    ],
    keywords: ['health', 'healthy', 'financial health', 'financially', 'stable', 'secure', 'score', 'rating', 'grade'],
    weight: 10,
  },
  greeting: {
    patterns: [
      /^(?:hi|hello!*|hey!*)\s*[!. ]*$/i,
      /^(?:hi|hello|hey|howdy|greetings|good\s+(?:morning|afternoon|evening)|sup|yo|hola|namaste|namaskar)[!. ]*$/i,
    ],
    keywords: ['hi', 'hello', 'hey', 'greetings'],
    weight: 25,
  },
  help: {
    patterns: [
      /^help$/,
      /\b(?:what\s+can\s+you\s+do)\b/,
      /\b(?:how\s+do\s+(?:i|we)\s+use\s+(?:you|this))\b/,
      /\b(?:capabilities|features|commands?)\b/,
      /\b(?:what\s+(?:do|does)\s+you\s+do)\b/,
      /\b(?:list|show)\s+(?:your|all)\s+(?:features?|capabilities|commands?|options?|abilities)\b/,
    ],
    keywords: ['help', 'capabilities', 'features', 'commands', 'abilities', 'what can you do'],
    weight: 5,
  },
};

function detectIntent(query) {
  const q = query.toLowerCase().trim();

  if (q.length === 0) {
    return { intent: 'greeting', confidence: 0.5, multiIntents: [] };
  }

  const scores = [];

  for (const [intentName, def] of Object.entries(INTENT_KEYWORD_MAP)) {
    let matchCount = 0;
    for (const pattern of def.patterns) {
      if (pattern.test(q)) matchCount++;
    }
    if (matchCount > 0) {
      const baseScore = def.weight + (matchCount - 1) * 5;
      const score = Math.min(baseScore, 30);
      scores.push({ intent: intentName, score, matchCount });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    for (const [intentName, def] of Object.entries(INTENT_KEYWORD_MAP)) {
      if (!def.keywords || def.keywords.length === 0) continue;
      for (const kw of def.keywords) {
        if (q.includes(kw)) {
          scores.push({ intent: intentName, score: 3, matchCount: 1 });
          break;
        }
      }
    }
    scores.sort((a, b) => b.score - a.score);
  }

  if (scores.length === 0) {
    return { intent: 'unknown', confidence: 0, multiIntents: [] };
  }

  const topScore = scores[0];
  const confidence = Math.min(topScore.score / 15, 1.0);

  const multiIntents = scores
    .filter(s => s.intent !== topScore.intent && s.score >= 5)
    .slice(0, 2)
    .map(s => ({ intent: s.intent, confidence: Math.min(s.score / 15, 1.0) }));

  return { intent: topScore.intent, confidence, multiIntents };
}

function analyzeMessage(query) {
  const { intent, confidence, multiIntents } = detectIntent(query);
  const dateInfo = parseDateExpression(query);
  const category = extractCategory(query);
  const allCategories = extractAllCategories(query);
  const goalName = extractGoalName(query);
  const investmentType = extractInvestmentType(query);
  const amount = extractAmount(query);

  const q = query.toLowerCase();
  const sentiment = Object.entries(SENTIMENT_PATTERNS).reduce((found, [s, p]) => {
    if (p.test(q)) found.push(s);
    return found;
  }, []);

  const isComparison = COMPARISON_PATTERNS.test(q);
  const isHighest = HIGHEST_PATTERNS.test(q);
  const isLowest = LOWEST_PATTERNS.test(q);
  const isBest = BEST_PATTERNS.test(q);
  const isWorst = WORST_PATTERNS.test(q);
  const isRemaining = REMAINING_PATTERNS.test(q);
  const isOverspent = OVERSPENT_PATTERNS.test(q);
  const isAll = ALL_PATTERNS.test(q);
  const isCombined = /\b(?:combined|together|total|sum|aggregate)\b/.test(q);
  const isTimeComparison = /\b(?:last\s+month|previous\s+month|vs\s+last|compared\s+to\s+last|month\s+over\s+month|this\s+month\s+vs|over\s+time|trend)\b/.test(q);

  const secondaryCategory = allCategories.length > 1 ? allCategories[1] : null;

  return {
    intent,
    confidence,
    multiIntents,
    dateInfo,
    category,
    secondaryCategory,
    allCategories,
    goalName,
    investmentType,
    amount,
    sentiment,
    flags: {
      isComparison: isComparison || isTimeComparison,
      isHighest,
      isLowest,
      isBest,
      isWorst,
      isAll,
      isRemaining,
      isOverspent,
      isCombined,
      isMultipleCategories: allCategories.length > 1,
      isTimeComparison,
    },
    rawQuery: query,
  };
}

module.exports = {
  analyzeMessage,
  detectIntent,
  extractCategory,
  extractAllCategories,
  extractGoalName,
  extractInvestmentType,
  extractAmount,
  CATEGORY_ALIASES,
  GOAL_ALIASES,
  INVESTMENT_ALIASES,
};
