const { parseDateExpression } = require('../utils/dateParser');

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Food', 'Dining', 'Restaurant', 'Groceries',
  'Shopping', 'Electronics', 'Clothing', 'Fashion',
  'Bills & Utilities', 'Bills', 'Utilities', 'Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Mobile',
  'Transport', 'Transportation', 'Fuel', 'Petrol', 'Diesel', 'Cab', 'Taxi', 'Uber', 'Ola', 'Parking', 'Metro', 'Bus',
  'Healthcare', 'Medical', 'Health', 'Doctor', 'Hospital', 'Pharmacy', 'Medicine', 'Insurance',
  'Entertainment', 'Movies', 'Gaming', 'Sports', 'Streaming', 'Netflix', 'Spotify',
  'Education', 'Course', 'Learning', 'Books', 'Fees', 'Tuition',
  'Rent', 'Housing', 'EMI',
  'Travel', 'Vacation', 'Trip', 'Flight', 'Hotel', 'Booking',
  'Subscriptions', 'Subscription', 'Memberships',
  'Personal Care', 'Grooming', 'Salon', 'Gym', 'Fitness',
  'Gifts', 'Donations', 'Charity',
  'Insurance', 'Premium',
  'Taxes', 'Tax',
  'Other', 'Miscellaneous',
];

const GOAL_NAMES = [
  'Emergency Fund', 'Emergency', 'Rainy Day',
  'Car Purchase', 'Car', 'Vehicle', 'Bike', 'Motorcycle',
  'Vacation', 'Trip', 'Travel', 'Holiday', 'Tour',
  'Higher Education', 'Education', 'Masters', 'MBA', 'College', 'University',
  'Wedding', 'Marriage',
  'Home Purchase', 'House', 'Home', 'Flat', 'Apartment',
  'Retirement', 'Pension',
  'New Phone', 'Phone', 'Laptop', 'Gadget',
  'Down Payment', 'Down Payment Fund',
  'Wealth Building', 'Wealth', 'Net Worth',
];

const INVESTMENT_TYPES = [
  'Stocks', 'Stock', 'Equity', 'Shares',
  'Mutual Funds', 'Mutual Fund', 'MF', 'SIP',
  'Fixed Deposit', 'FD', 'Term Deposit',
  'PPF', 'Public Provident Fund',
  'NPS', 'National Pension System',
  'Crypto', 'Cryptocurrency', 'Bitcoin', 'Ethereum', 'BTC', 'ETH',
  'Gold', 'Sovereign Gold Bond', 'SGB',
  'Real Estate', 'Property',
  'Bonds', 'Bond', 'Government Bond',
  'ETF', 'Exchange Traded Fund',
];

const INTENT_DEFINITIONS = [
  {
    intent: 'greeting',
    patterns: [
      /^(?:hi|hello!*|hey!*)\s*[!. ]*$/i,
      /^(?:hi|hello|hey|howdy|greetings|good\s+(?:morning|afternoon|evening)|sup|yo|hola|namaste|namaskar|namaskaram)[!. ]*$/i,
      /^(?:thanks|thank\s*you|thankyou|ty|thx)[!. ]*$/i,
      /^(?:bye|goodbye|see\s+you|see\s+ya|take\s+care|ttyl|cya)[!. ]*$/i,
    ],
    weight: 20,
    priority: 1,
  },
  {
    intent: 'expense_summary',
    patterns: [
      /\b(?:how\s+much\s+(?:did\s+)?(?:i|we)\s+(?:spend|spent|expended|used))\b/,
      /\b(?:spend|spent|expense|expenses|expenditure|spending|costs?)\b.*\b(?:month|week|today|yesterday|year|total|overall|last|this|previous)\b/,
      /\b(?:month|week|today|yesterday|year|total|overall|last|this|previous)\b.*\b(?:spend|spent|expense|expenses|expenditure|spending|costs?)\b/,
      /\b(?:total|overall|aggregate)\s+(?:spending|expense|expenditure|cost)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:expense|spending|expenditure|cost)\b/,
      /\b(?:expense|spending|expenditure)\s+(?:summary|overview|breakdown|report|analysis|detail)\b/,
      /\b(?:what\s+(?:did\s+)?(?:i|we)\s+spend)\b/,
      /\b(?:what\s+was\s+(?:my|our)\s+spending)\b/,
      /\b(?:where\s+(?:did\s+)?(?:i|we)\s+(?:spend|go))\b/,
      /\b(?:money\s+(?:spent|going|flowing|out))\b/,
      /\b(?:billing|bill)\b/,
      /\b(?:spending)\s+(?:in|for|during)\b/,
    ],
    weight: 10,
    priority: 5,
  },
  {
    intent: 'expense_category',
    patterns: [
      /\b(?:which|what)\s+(?:category|categories)\b/,
      /\b(?:highest|top|biggest|largest|most|maximum)\s+(?:expense|spending|category|cost|expenditure)\b/,
      /\b(?:lowest|smallest|least|minimum|least\s+spent)\b.*\b(?:category|expense|spending)\b/,
      /\b(?:category|categories)\s+(?:expense|spending|breakdown|analysis|wise|distribution)\b/,
      /\b(?:break\s?down|split|segregate)\b.*\b(?:expense|spending|cost)\b/,
      /\b(?:expense|spending)\s+(?:by\s+)?category\b/,
      /\b(?:how\s+much\s+(?:did\s+)?(?:i|we)\s+spend\s+on)\b/,
      /\b(?:spent\s+on)\b/,
      /\b(?:spend(?:ing)?|cost|expense)\s+(?:on|for)\s+(?:food|shopping|bills|transport|healthcare|entertainment|education|rent|travel|subscriptions|personal\s+care|gifts|insurance|taxes?)\b/,
    ],
    weight: 10,
    priority: 6,
  },
  {
    intent: 'budget_status',
    patterns: [
      /\b(?:budget|budgets)\s+(?:status|report|overview|health|check|utilization|usage)\b/,
      /\b(?:status|report|overview|health|check)\b.*\b(?:budget|budgets)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:exceed|overspend|over\s+budget|over\s+spend|under\s+budget|within\s+budget)\b/,
      /\b(?:within|inside)\s+(?:my|our|the)\s+budget\b/,
      /\b(?:exceed|exceeded|overspend|overspent|over\s+spend)\b.*\b(?:budget|limit)\b/,
      /\b(?:budget)\b.*\b(?:exceed|exceeded|over|remain|left|remaining|leftover|used|utilized)\b/,
      /\b(?:budgets?)\b.*\b(?:exceed|exceeded|over|overspent)\b/,
      /\b(?:remain|left|leftover|available)\b.*\b(?:budget|money|amount)\b/,
      /\b(?:which|what)\s+(?:budget|category)\s+(?:closest|nearing|near|limit|exceeded|over)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:budget|budgets)\b/,
      /\b(?:how\s+much\s+(?:budget|money)\s+is\s+remaining)\b/,
      /\b(?:budget)\s+(?:remaining|left|utilized|spent|used)\b/,
      /\b(?:all\s+)?(?:budget|budgets)\s+(?:that|where|which)\s+(?:i|we)\s+(?:exceed|over|exceeded)\b/,
      /\b(?:overbudget|over-budget)\b/,
      /\b(?:am\s+(?:i|we)\s+(?:over|exceeding|exceed|overbudget))\b/,
      /\b(?:spending)\s+(?:over|above|beyond|more\s+than)\b/,
      /\bshow\b.*\bmy\b.*\bbudget\b/,
      /\bbudget\b.*\bstatus\b/,
    ],
    weight: 10,
    priority: 6,
  },
  {
    intent: 'savings_analysis',
    patterns: [
      /\b(?:savings?\s+rate|saving\s+rate)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:saving|save)\s+enough\b/,
      /\b(?:why\s+(?:is|are)\s+(?:my|our)\s+(?:financial|savings|money)\s+(?:health|low|bad|poor|low))\b/,
      /\b(?:improve|increase|boost|better)\s+(?:my|our)\s+(?:savings?|saving\s+rate)\b/,
      /\b(?:can\s+(?:i|we)\s+)?(?:save|saving)\s+(?:\d|₹|\$|£|€|inr|usd|gbp|eur)\b/,
      /\b(?:how\s+much\s+(?:should|can|do)\s+(?:i|we)\s+save)\b/,
      /\b(?:savings?|saved|saving)\b.*\b(?:enough|sufficient|adequate|goal|target)\b/,
      /\b(?:reduce|cut|lower)\s+(?:spending|expense|expenses|cost)\b/,
      /\b(?:what\s+percentage\s+of\s+(?:my|our)\s+income\s+am\s+(?:i|we)\s+saving)\b/,
      /\b(?:show\s+(?:my|our)\s+savings\s+(?:rate|percentage|percent))\b/,
      /\b(?:how\s+much\s+am\s+(?:i|we)\s+saving)\b/,
    ],
    weight: 10,
    priority: 7,
  },
  {
    intent: 'investment_performance',
    patterns: [
      /\b(?:investments?|portfolio|mutual\s+funds?|stocks?|shares?|etf|crypto|gold|bonds?|fd|ppf|nps)\b.*\b(?:perform|doing|performance|return|returns|grow|growth|profit|loss|value|analysis)\b/,
      /\b(?:perform|doing|performance|return|returns|grow|growth|profit|loss|value|analysis)\b.*\b(?:investments?|portfolio|mutual\s+funds?|stocks?|shares?|etf|crypto|gold|bonds?|fd|ppf|nps)\b/,
      /\b(?:which|what)\s+(?:investments?|investment|stock|mutual\s+fund|fund|etf|asset)\s+(?:is|are)\s+(?:best|worst|performing|growing|doing)\b/,
      /\b(?:best|worst|top|highest|lowest|underperform)\b.*\b(?:invest|investment|stock|fund|asset|return|roi)\b/,
      /\b(?:total|overall|combined)\s+(?:portfolio|investment|invested|value|returns?|profit|loss)\b/,
      /\b(?:portfolio|investments?|investing)\s+(?:value|worth|total|summary|overview|allocation|distribution)\b/,
      /\b(?:how\s+(?:are|is|do|did|will)\s+(?:my|our|the)\s+)?(?:investments?|portfolio|mutual\s+funds?|stocks?)\s+(?:performing|doing|growing|going|looking)\b/,
      /\b(?:how\s+much\s+(?:profit|loss|money|return))\s+(?:have\s+)?(?:i|we)\s+(?:made|earned|got|lost|have)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:invest|investment|portfolio)\b/,
      /\b(?:invest|invested|investment|investing)\b.*\b(?:total|amount|overall|summary|overview)\b/,
      /\b(?:which\s+asset|which\s+stock|which\s+fund)\b/,
      /\b(?:review|revisit|reassess)\b.*\b(?:invest|investment|portfolio)\b/,
      /\b(?:portfolio|invest)\w*\s+(?:return|returns|profit|loss|gain|growth)\b/,
    ],
    weight: 10,
    priority: 7,
  },
  {
    intent: 'goal_progress',
    patterns: [
      /\b(?:goals?|targets?|milestones?)\s+(?:progress|status|track|tracking|update|overview|report|plan|planning)\b/,
      /\b(?:progress|status|track|tracking|update|overview|report)\b.*\b(?:goals?|targets?|milestones?)\b/,
      /\b(?:how\s+(?:close|far|much))\s+(?:am\s+(?:i|we)\s+)?(?:to|from|toward)\b.*\b(?:goal|target|milestone|fund)\b/,
      /\b(?:emergency\s+fund|car\s+purchase|vacation|higher\s+education|wedding|home|retirement|phone|laptop)\b.*\b(?:progress|status|close|remaining|complete|done|achieve)\b/,
      /\b(?:how\s+much\s+is\s+remaining)\b/,
      /\b(?:remaining)\b.*\b(?:goal|fund|target|for)\b/,
      /\b(?:for)\b.*\b(?:goal|fund|emergency|car|vacation|wedding|home|retirement|phone|laptop|education)\b/,
      /\b(?:when\s+(?:will|shall|can)\s+(?:i|we)\s+(?:complete|finish|achieve|reach|meet))\b/,
      /\b(?:fastest|slowest)\s+(?:growing|growing)\b.*\b(?:goal|fund)\b/,
      /\b(?:how\s+much\s+should\s+(?:i|we)\s+save\s+monthly)\b/,
      /\b(?:which|what)\s+(?:goals?|targets?)\s+(?:are|is)\s+(?:overdue|behind|ahead|achieved|done|completed|active|paused)\b/,
      /\b(?:show|give|get|tell|see|view|display)\b.*\b(?:goals?|targets?)\b/,
      /\b(?:goals?|targets?)\b.*\b(?:achieve|complete|finish|reach|meet|done)\b/,
      /\b(?:how\s+much\s+(?:is|are)\s+remaining\s+for)\b/,
      /\bremaining\s+(?:for|of|in)\b.*\b(?:fund|goal|emergency|car|vacation|wedding|home|retirement|phone|laptop|education)\b/,
    ],
    weight: 10,
    priority: 8,
  },
  {
    intent: 'financial_report',
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
      /\b(?:expense|spending)\s+(?:compare|comparison|vs|versus)\b/,
      /\b(?:give\s+(?:me\s+)?(?:a\s+)?(?:complete|full|detailed)\s+(?:financial|money)\s+report)\b/,
      /\b(?:complete|full)\s+(?:financial|money)\s+report\b/,
    ],
    weight: 9,
    priority: 9,
  },
  {
    intent: 'advice',
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
    ],
    weight: 9,
    priority: 10,
  },
  {
    intent: 'financial_health',
    patterns: [
      /\b(?:financial\s+health|health\s+score|money\s+health|financial\s+score|health\s+check)\b/,
      /\b(?:am\s+(?:i|we)\s+)?(?:doing|doing\s+well|on\s+track|financially\s+(?:stable|secure|healthy|strong))\b/,
      /\b(?:how\s+(?:is|are|do)\s+(?:my|our)\s+(?:finances?|financial|money|finance))\b/,
      /\b(?:overall\s+(?:health|score|rating|grade|status))\b/,
      /\b(?:improve|increase|boost|better|fix)\s+(?:my|our)\s+(?:financial|finance|money|financial\s+health)\b/,
      /\b(?:my\s+financial|financial\s+status|financial\s+overview)\b/,
      /\b(?:wasting|waste)\s+money\b/,
      /\b(?:biggest\s+)?(?:financial\s+)?risk\b/,
      /\b(?:is\s+my\s+savings\s+rate\s+good)\b/,
    ],
    weight: 9,
    priority: 10,
  },
  {
    intent: 'help',
    patterns: [
      /^help$/,
      /\b(?:what\s+can\s+you\s+do)\b/,
      /\b(?:how\s+do\s+(?:i|we)\s+use\s+(?:you|this))\b/,
      /\b(?:capabilities|features|commands?)\b/,
      /\b(?:what\s+(?:do|does)\s+you\s+do)\b/,
      /\b(?:list|show)\s+(?:your|all)\s+(?:features?|capabilities|commands?|options?|abilities)\b/,
    ],
    weight: 5,
    priority: 15,
  },
];

const CATEGORY_ALIASES = {
  'food': 'Food & Dining', 'dining': 'Food & Dining', 'restaurant': 'Food & Dining', 'groceries': 'Food & Dining', 'grocery': 'Food & Dining',
  'shopping': 'Shopping', 'electronics': 'Shopping', 'clothing': 'Shopping', 'fashion': 'Shopping',
  'bills': 'Bills & Utilities', 'utilities': 'Bills & Utilities', 'electricity': 'Bills & Utilities', 'water': 'Bills & Utilities', 'gas': 'Bills & Utilities', 'internet': 'Bills & Utilities', 'phone': 'Bills & Utilities', 'mobile': 'Bills & Utilities',
  'transport': 'Transport', 'transportation': 'Transport', 'fuel': 'Transport', 'petrol': 'Transport', 'diesel': 'Transport', 'cab': 'Transport', 'taxi': 'Transport', 'uber': 'Transport', 'ola': 'Transport', 'parking': 'Transport', 'metro': 'Transport', 'bus': 'Transport',
  'healthcare': 'Healthcare', 'medical': 'Healthcare', 'health': 'Healthcare', 'doctor': 'Healthcare', 'hospital': 'Healthcare', 'pharmacy': 'Healthcare', 'medicine': 'Healthcare',
  'entertainment': 'Entertainment', 'movies': 'Entertainment', 'gaming': 'Entertainment', 'sports': 'Entertainment', 'streaming': 'Entertainment', 'netflix': 'Entertainment', 'spotify': 'Entertainment',
  'education': 'Education', 'course': 'Education', 'learning': 'Education', 'books': 'Education', 'fees': 'Education', 'tuition': 'Education',
  'rent': 'Rent', 'housing': 'Rent', 'emi': 'Rent',
  'travel': 'Travel', 'vacation': 'Travel', 'trip': 'Travel', 'flight': 'Travel', 'hotel': 'Travel', 'booking': 'Travel',
  'subscriptions': 'Subscriptions', 'subscription': 'Subscriptions', 'memberships': 'Subscriptions',
  'personal care': 'Personal Care', 'grooming': 'Personal Care', 'salon': 'Personal Care', 'gym': 'Personal Care', 'fitness': 'Personal Care',
  'gifts': 'Gifts', 'donations': 'Gifts', 'charity': 'Gifts',
  'insurance': 'Insurance', 'premium': 'Insurance',
  'taxes': 'Taxes', 'tax': 'Taxes',
};

const GOAL_ALIASES = {
  'emergency fund': 'Emergency Fund', 'emergency': 'Emergency Fund', 'rainy day': 'Emergency Fund',
  'car purchase': 'Car Purchase', 'car': 'Car Purchase', 'vehicle': 'Car Purchase', 'bike': 'Car Purchase', 'motorcycle': 'Car Purchase',
  'vacation': 'Vacation', 'trip': 'Vacation', 'travel': 'Vacation', 'holiday': 'Vacation', 'tour': 'Vacation',
  'higher education': 'Higher Education', 'education': 'Higher Education', 'masters': 'Higher Education', 'mba': 'Higher Education', 'college': 'Higher Education', 'university': 'Higher Education',
  'wedding': 'Wedding', 'marriage': 'Wedding',
  'home purchase': 'Home Purchase', 'house': 'Home Purchase', 'home': 'Home Purchase', 'flat': 'Home Purchase', 'apartment': 'Home Purchase',
  'retirement': 'Retirement', 'pension': 'Retirement',
  'new phone': 'New Phone', 'phone': 'New Phone', 'laptop': 'New Phone', 'gadget': 'New Phone',
  'down payment': 'Down Payment',
  'wealth building': 'Wealth Building', 'wealth': 'Wealth Building', 'net worth': 'Wealth Building',
};

const INVESTMENT_ALIASES = {
  'stock': 'Stocks', 'equity': 'Stocks', 'shares': 'Stocks', 'share': 'Stocks',
  'mutual fund': 'Mutual Funds', 'mf': 'Mutual Funds', 'sip': 'Mutual Funds',
  'fixed deposit': 'Fixed Deposit', 'fd': 'Fixed Deposit', 'term deposit': 'Fixed Deposit',
  'ppf': 'PPF', 'public provident fund': 'PPF',
  'nps': 'NPS', 'national pension system': 'NPS',
  'crypto': 'Crypto', 'cryptocurrency': 'Crypto', 'bitcoin': 'Crypto', 'ethereum': 'Crypto', 'btc': 'Crypto', 'eth': 'Crypto',
  'gold': 'Gold', 'sovereign gold bond': 'Gold', 'sgb': 'Gold',
  'real estate': 'Real Estate', 'property': 'Real Estate',
  'bonds': 'Bonds', 'bond': 'Bonds', 'government bond': 'Bonds',
  'etf': 'ETF', 'exchange traded fund': 'ETF',
};

function extractCategory(query) {
  const q = query.toLowerCase();
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) return canonical;
  }
  return null;
}

function extractGoalName(query) {
  const q = query.toLowerCase();
  const sortedAliases = Object.entries(GOAL_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sortedAliases) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(q)) return canonical;
  }
  return null;
}

function extractInvestmentType(query) {
  const q = query.toLowerCase();
  for (const [alias, canonical] of Object.entries(INVESTMENT_ALIASES)) {
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
    /(?:£|gbp|pounds?)\s*(\d[\d,]*\.?\d*)/i,
    /(\d[\d,]*\.?\d*)\s*(?:£|gbp|pounds?)/i,
    /(?:€|eur|euros?)\s*(\d[\d,]*\.?\d*)/i,
    /(\d[\d,]*\.?\d*)\s*(?:€|eur|euros?)/i,
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

function extractFinancialKeywords(query) {
  const q = query.toLowerCase();
  const keywords = [];
  const keywordMap = {
    expense: 'expense_summary', spend: 'expense_summary', spending: 'expense_summary', spent: 'expense_summary',
    budget: 'budget_status', budgets: 'budget_status',
    saving: 'savings_analysis', savings: 'savings_analysis', save: 'savings_analysis',
    invest: 'investment_performance', investment: 'investment_performance', portfolio: 'investment_performance',
    goal: 'goal_progress', goals: 'goal_progress', target: 'goal_progress',
    income: 'financial_report', salary: 'financial_report', earning: 'financial_report',
    health: 'financial_health', financial: 'financial_health',
    fund: 'goal_progress', emergency: 'goal_progress',
  };
  for (const [word, intent] of Object.entries(keywordMap)) {
    if (q.includes(word)) {
      keywords.push({ word, intent });
    }
  }
  return keywords;
}

function detectIntent(query) {
  const q = query.toLowerCase().trim();
  const scores = [];

  for (const def of INTENT_DEFINITIONS) {
    let matchCount = 0;
    for (const pattern of def.patterns) {
      if (pattern.test(q)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const baseScore = def.weight + (matchCount - 1) * 3;
      const priorityBonus = (20 - (def.priority || 10)) * 0.5;
      const score = baseScore + priorityBonus;
      scores.push({ intent: def.intent, score, matchCount, priority: def.priority || 10 });
    }
  }

  scores.sort((a, b) => b.score - a.score || a.priority - b.priority);

  if (scores.length === 0) {
    const keywords = extractFinancialKeywords(q);
    if (keywords.length > 0) {
      const intentCounts = {};
      keywords.forEach(k => { intentCounts[k.intent] = (intentCounts[k.intent] || 0) + 1; });
      const bestIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0][0];
      return { intent: bestIntent, confidence: 0.35, keywords };
    }
    return { intent: 'unknown', confidence: 0, keywords: [] };
  }

  const best = scores[0];
  const confidence = Math.min(best.score / 12, 1.0);
  return { intent: best.intent, confidence };
}

function analyzeQuery(query) {
  const { intent, confidence, keywords } = detectIntent(query);
  const dateInfo = parseDateExpression(query);
  const category = extractCategory(query);
  const goalName = extractGoalName(query);
  const investmentType = extractInvestmentType(query);
  const amount = extractAmount(query);

  const q = query.toLowerCase();
  const isComparison = /\b(?:compare|comparison|vs|versus|against|difference|change|trend|compare\s+with)\b/.test(q);
  const isHighest = /\b(?:highest|top|biggest|largest|most|maximum|max)\b/.test(q);
  const isLowest = /\b(?:lowest|smallest|least|minimum|min)\b/.test(q);
  const isBest = /\b(?:best|best\s+performing|highest\s+return|top\s+performer)\b/.test(q);
  const isWorst = /\b(?:worst|worst\s+performing|lowest\s+return|underperform)\b/.test(q);
  const isAll = /\b(?:all|every|each|entire|list\s+all|show\s+all)\b/.test(q);
  const isRemaining = /\b(?:remain|remaining|left|leftover|available|still)\b/.test(q);
  const isOverspent = /\b(?:exceed|exceeded|over|overspent|overbudget|over\s+budget)\b/.test(q);
  const isCombined = /\b(?:combined|together|total|sum|aggregate)\b/.test(q);
  const isMultipleCategories = /\b(?:and|&|\+)\b/.test(query) && category;

  let secondaryCategory = null;
  if (isMultipleCategories) {
    for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
      if (canonical !== category) {
        const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
        if (regex.test(q)) {
          secondaryCategory = canonical;
          break;
        }
      }
    }
  }

  const result = {
    intent,
    confidence,
    dateInfo,
    category,
    secondaryCategory,
    goalName,
    investmentType,
    amount,
    flags: {
      isComparison,
      isHighest,
      isLowest,
      isBest,
      isWorst,
      isAll,
      isRemaining,
      isOverspent,
      isCombined,
      isMultipleCategories,
    },
    rawQuery: query,
    keywords: keywords || [],
  };

  console.log(`[NLP] Query: "${query}" → intent=${intent}, confidence=${confidence.toFixed(2)}, goal=${goalName || 'none'}, date=${dateInfo.monthStr}`);

  return result;
}

module.exports = {
  analyzeQuery,
  detectIntent,
  extractCategory,
  extractGoalName,
  extractInvestmentType,
  extractAmount,
  extractFinancialKeywords,
  EXPENSE_CATEGORIES,
  GOAL_NAMES,
  INVESTMENT_TYPES,
};
