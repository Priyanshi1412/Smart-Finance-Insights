const { analyzeMessage } = require('./aiIntentEngine');
const { getMonthRange, formatMonthStr } = require('../utils/dateParser');
const { chatWithGemini, formatFinancialContext } = require('./geminiService');
const {
  getExpenseSummary,
  getBudgetSummary,
  getInvestmentSummary,
  getGoalSummary,
  getFinancialHealthData,
  fmtCurrency,
  formatPercent,
  formatDate,
  formatMonthLabel,
  getPreviousMonth,
} = require('./financialQueryService');
const { buildFinancialContext, buildConversationSummary } = require('./financialContextBuilder');
const { Expense, Income, Budget, Goal, Investment } = require('../models');

function fmt(val, currency = 'INR') {
  return fmtCurrency(val, currency);
}

const sessionContext = new Map();

const CONVERSATION_HISTORY = new Map();
const MAX_HISTORY = 10;

function getSessionContext(userId) {
  if (!sessionContext.has(userId)) {
    sessionContext.set(userId, {
      lastIntent: null,
      lastDateInfo: null,
      lastEntities: {},
      lastTopic: null,
      timestamp: Date.now(),
    });
  }
  const ctx = sessionContext.get(userId);
  if (Date.now() - ctx.timestamp > 30 * 60 * 1000) {
    sessionContext.set(userId, {
      lastIntent: null,
      lastDateInfo: null,
      lastEntities: {},
      lastTopic: null,
      timestamp: Date.now(),
    });
  }
  return sessionContext.get(userId);
}

function updateSessionContext(userId, intent, dateInfo, entities = {}) {
  const prev = sessionContext.get(userId) || {};
  sessionContext.set(userId, {
    lastIntent: intent,
    lastDateInfo: dateInfo,
    lastEntities: entities,
    lastTopic: prev.lastTopic || intent,
    timestamp: Date.now(),
  });
}

function getConversationHistory(userId) {
  if (!CONVERSATION_HISTORY.has(userId)) {
    CONVERSATION_HISTORY.set(userId, []);
  }
  return CONVERSATION_HISTORY.get(userId);
}

function addToHistory(userId, role, text) {
  const history = getConversationHistory(userId);
  history.push({ role, text, timestamp: Date.now() });
  if (history.length > MAX_HISTORY * 2) {
    history.splice(0, history.length - MAX_HISTORY * 2);
  }
}

function resolveDateWithFallback(dateInfo, sessionCtx) {
  const q = (dateInfo && dateInfo.label) || '';
  const hasExplicitDate = /\b(today|yesterday|this\s+week|last\s+week|this\s+month|last\s+month|this\s+year|last\s+year|this\s+quarter|last\s+quarter|last\s+\d+\s+months?|recent|recently|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/.test(q);
  if (hasExplicitDate) return dateInfo;
  if (sessionCtx && sessionCtx.lastDateInfo) return sessionCtx.lastDateInfo;
  return dateInfo;
}

function isFollowUp(query) {
  const q = query.toLowerCase().trim();
  const followUpPatterns = [
    /^(?:what about|how about|and|also|what else|tell me more|anything else|more|continue|ok|okay|sure|yes|no|nope|yep|yeah|nah|got it|hmm|hm|oh|i see|understood)\b/,
    /^(?:what about|how about)\s/,
    /^(?:and|also)\s/,
  ];
  return followUpPatterns.some(p => p.test(q));
}

function detectSentiment(query) {
  const q = query.toLowerCase();
  if (/\b(?:worried|concerned|anxious|nervous|scared|panic|stressed|tense|bad|terrible|awful|horrible)\b/.test(q)) return 'negative';
  if (/\b(?:happy|great|awesome|amazing|wonderful|excellent|fantastic|good|nice|glad|pleased|solid|perfect)\b/.test(q)) return 'positive';
  if (/\b(?:frustrated|annoyed|irritated|angry|mad|furious|upset|disappointed|hate|worst)\b/.test(q)) return 'frustrated';
  return 'neutral';
}

function getSuggestionsForIntent(intent, context) {
  const suggestions = [];
  const hasBudget = context && context.budget && context.budget.totalBudget > 0;
  const hasInvestments = context && context.investments && context.investments.totalInvested > 0;
  const hasGoals = context && context.goals && context.goals.active && context.goals.active.length > 0;

  switch (intent) {
    case 'greeting':
      suggestions.push(
        { text: 'How much did I spend this month?', icon: '💳' },
        { text: 'What is my financial health score?', icon: '❤️' },
        { text: 'Show my budget status', icon: '📊' },
      );
      break;
    case 'expense_summary':
      suggestions.push(
        { text: 'Compare this month vs last month', icon: '📋' },
        { text: 'Which category is hurting my budget the most?', icon: '🔍' },
        { text: 'Where am I wasting money?', icon: '💸' },
      );
      break;
    case 'expense_category':
      suggestions.push(
        { text: 'Compare this month vs last month', icon: '📋' },
        { text: 'Show my budget status', icon: '📊' },
        { text: 'What should I improve financially?', icon: '💡' },
      );
      break;
    case 'budget_status':
      suggestions.push(
        { text: 'How much did I spend this month?', icon: '💳' },
        { text: 'What is my savings rate?', icon: '💰' },
        { text: 'Give me budget recommendations', icon: '💡' },
      );
      break;
    case 'savings_analysis':
      suggestions.push(
        { text: 'Can I save ₹10,000 next month?', icon: '🎯' },
        { text: 'What is my financial health score?', icon: '❤️' },
        { text: 'How close am I to my emergency fund goal?', icon: '🎯' },
      );
      break;
    case 'investment_performance':
      suggestions.push(
        { text: 'Which investment is performing best?', icon: '📈' },
        { text: 'Show my portfolio allocation', icon: '📊' },
        { text: 'What investment should I review?', icon: '🔍' },
      );
      break;
    case 'goal_progress':
      suggestions.push(
        { text: 'How close am I to my emergency fund goal?', icon: '🎯' },
        { text: 'What is my savings rate?', icon: '💰' },
        { text: 'Give me a complete financial report', icon: '📑' },
      );
      break;
    case 'financial_report':
      suggestions.push(
        { text: 'What should I improve financially?', icon: '💡' },
        { text: 'Compare this month vs last month', icon: '📋' },
        { text: 'Where am I wasting money?', icon: '💸' },
      );
      break;
    case 'financial_health':
      suggestions.push(
        { text: 'Give me personalized financial advice', icon: '🤝' },
        { text: 'How close am I to my emergency fund goal?', icon: '🎯' },
        { text: 'Show my budget status', icon: '📊' },
      );
      break;
    case 'advice':
      suggestions.push(
        { text: 'Give me a complete financial report', icon: '📑' },
        { text: 'Compare this month vs last month', icon: '📋' },
        { text: 'How are my investments performing?', icon: '📈' },
      );
      break;
    case 'ai_response':
      suggestions.push(
        { text: 'How much did I spend this month?', icon: '💳' },
        { text: 'What is my financial health score?', icon: '❤️' },
        { text: 'Show my budget status', icon: '📊' },
      );
      break;
    default:
      suggestions.push(
        { text: 'How much did I spend this month?', icon: '💳' },
        { text: 'What is my financial health score?', icon: '❤️' },
        { text: 'Show my budget status', icon: '📊' },
      );
  }
  return suggestions.slice(0, 3);
}

function sentimentPrefix(sentiment) {
  switch (sentiment) {
    case 'negative': return "I understand this is concerning. ";
    case 'frustrated': return "I hear you. Let me help clarify things. ";
    case 'positive': return "Great to hear! ";
    default: return '';
  }
}

async function processQuery(userId, rawQuery) {
  const parsed = analyzeMessage(rawQuery);
  const {
    intent,
    confidence,
    multiIntents,
    dateInfo: rawDateInfo,
    category,
    secondaryCategory,
    goalName,
    investmentType,
    amount,
    sentiment,
    flags,
    rawQuery: query,
  } = parsed;

  const sessionCtx = getSessionContext(userId);
  const dateInfo = resolveDateWithFallback(rawDateInfo, sessionCtx);
  const currency = 'INR';

  console.log(`[JARVIS] Processing: "${rawQuery}" → intent=${intent}, confidence=${confidence.toFixed(2)}, sentiment=${sentiment.join(',') || 'neutral'}`);

  addToHistory(userId, 'user', rawQuery);

  try {
    let context = null;
    try {
      context = await buildFinancialContext(userId, dateInfo);
    } catch (ctxErr) {
      console.warn('[JARVIS] Context build failed, using fallback:', ctxErr.message);
    }

    let result;

    if (confidence < 0.2 && intent !== 'greeting' && intent !== 'unknown') {
      console.log(`[JARVIS] Low confidence (${confidence.toFixed(2)}), sending to Gemini with financial context`);
      const finCtx = formatFinancialContext(context);
      const geminiReply = await chatWithGemini(rawQuery, getConversationHistory(userId), finCtx);
      if (geminiReply) {
        result = { response: geminiReply, intent: 'ai_response' };
      } else {
        result = await handleContextualFallback(userId, rawQuery, context, sentiment, currency);
      }
    } else if (intent === 'unknown') {
      console.log(`[JARVIS] Unknown intent, sending to Gemini with financial context`);
      const finCtx = formatFinancialContext(context);
      const geminiReply = await chatWithGemini(rawQuery, getConversationHistory(userId), finCtx);
      if (geminiReply) {
        result = { response: geminiReply, intent: 'ai_response' };
      } else {
        result = await handleUnknown(rawQuery, context, getConversationHistory(userId));
      }
    } else {
      switch (intent) {
        case 'greeting':
          result = handleGreeting(rawQuery, sentiment, context);
          break;
        case 'help':
          result = handleHelp(context);
          break;
        case 'expense_summary':
          result = await handleExpenseSummary(userId, dateInfo, flags, context, currency);
          break;
        case 'expense_category':
          result = await handleExpenseCategory(userId, dateInfo, category, secondaryCategory, flags, context, currency);
          break;
        case 'budget_status':
          result = await handleBudgetStatus(userId, dateInfo, category, flags, context, currency);
          break;
        case 'savings_analysis':
          result = await handleSavingsAnalysis(userId, dateInfo, amount, context, currency);
          break;
        case 'investment_performance':
          result = await handleInvestmentPerformance(userId, investmentType, flags, context, currency);
          break;
        case 'goal_progress':
          result = await handleGoalProgress(userId, goalName, dateInfo, flags, context, currency);
          break;
        case 'financial_report':
          result = await handleFinancialReport(userId, dateInfo, flags, context, currency);
          break;
        case 'financial_health':
          result = await handleFinancialHealth(userId, rawQuery, context, currency);
          break;
        case 'advice':
          result = await handleAdvice(userId, rawQuery, context, sentiment, currency);
          break;
        default:
          result = await handleUnknown(rawQuery, context, getConversationHistory(userId));
          break;
      }

      if (result && result.response && intent !== 'greeting' && intent !== 'help') {
        const finCtx = formatFinancialContext(context);
        const geminiEnhanced = await chatWithGemini(
          `The user asked: "${rawQuery}"\n\nMy rule-based analysis produced this response:\n${result.response}\n\nNow improve this response. Make it more conversational, natural, and helpful. Keep the data accurate but present it in a friendly, advisor-like tone. Keep the Markdown formatting.`,
          getConversationHistory(userId),
          finCtx
        );
        if (geminiEnhanced) {
          result.response = geminiEnhanced;
          result.intent = 'ai_enhanced';
        }
      }
    }

    if (multiIntents && multiIntents.length > 0 && intent !== 'greeting' && intent !== 'help') {
      const secondaryResult = await handleMultiIntent(userId, multiIntents[0].intent, dateInfo, context, currency);
      if (secondaryResult) {
        result.response += '\n\n---\n\n' + secondaryResult.response;
      }
    }

    const suggestions = getSuggestionsForIntent(intent === 'ai_response' || intent === 'ai_enhanced' ? 'default' : intent, context);
    result.suggestions = suggestions;

    if (sentiment && sentiment.length > 0 && intent !== 'greeting') {
      result.response = sentimentPrefix(sentiment[0]) + result.response;
    }

    updateSessionContext(userId, intent, dateInfo, { category, goalName, investmentType });
    addToHistory(userId, 'assistant', result.response);

    console.log(`[JARVIS] Response intent: ${result.intent}, suggestions: ${suggestions.length}`);
    return result;
  } catch (err) {
    console.error(`[JARVIS] Error processing "${rawQuery}":`, err.message);
    return {
      response: `I encountered an issue while analyzing your finances. Could you try rephrasing your question? I can help with expenses, budgets, savings, investments, goals, and more.`,
      intent: 'error',
      suggestions: getSuggestionsForIntent('greeting', null),
    };
  }
}

function handleGreeting(rawQuery, sentiment, context) {
  const q = (rawQuery || '').toLowerCase();
  const now = new Date();
  const hour = now.getHours();

  if (/\b(thanks|thank\s*you|thankyou|ty|thx)\b/.test(q)) {
    return {
      response: "You're welcome! Feel free to ask me anything about your finances anytime.",
      intent: 'greeting',
    };
  }
  if (/\b(bye|goodbye|see\s+you|see\s+ya|take\s+care|ttyl|cya)\b/.test(q)) {
    return {
      response: "Goodbye! I'll be here whenever you need financial insights. Take care!",
      intent: 'greeting',
    };
  }

  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';

  let personalized = '';
  if (context) {
    const healthScore = context.health?.score;
    const savingsRate = context.currentMonth?.savingsRate;
    const anomalyCount = context.anomalies?.length || 0;

    if (healthScore >= 80) {
      personalized = ` Your financial health score is ${healthScore}/100 — you're doing well!`;
    } else if (healthScore >= 60) {
      personalized = ` Your financial health score is ${healthScore}/100 — solid, but there's room to improve.`;
    } else if (healthScore > 0) {
      personalized = ` Your financial health score is ${healthScore}/100 — let's work on improving it together.`;
    }

    if (anomalyCount > 0) {
      personalized += ` I noticed ${anomalyCount} area${anomalyCount > 1 ? 's' : ''} that might need your attention.`;
    }
  }

  const responses = [
    `${timeGreeting}! I'm JARVIS, your AI financial assistant.${personalized} What would you like to explore today?`,
    `${timeGreeting}! Welcome back.${personalized} Ask me anything about your spending, savings, investments, or financial goals.`,
    `${timeGreeting}! I'm here to help you stay on top of your finances.${personalized} What's on your mind?`,
  ];
  return {
    response: responses[Math.floor(Math.random() * responses.length)],
    intent: 'greeting',
  };
}

function handleHelp(context) {
  let personalNote = '';
  if (context) {
    const topCategory = context.currentMonth?.highestCategory;
    const savingsRate = context.currentMonth?.savingsRate;
    if (topCategory) {
      personalNote = `\n\nBased on your current data, your top spending area is **${topCategory.category}** at ${fmt(topCategory.amount)}. Your savings rate is **${formatPercent(savingsRate)}**.`;
    }
  }

  return {
    response: `I'm your AI financial assistant. Here's how I can help:

**Ask me anything** about your finances — I understand natural language, so just type your question:

**Expenses & Spending**
"How much did I spend this month?"
"Which category is hurting my budget the most?"
"Where am I wasting money?"

**Budget & Savings**
"Am I exceeding my budget?"
"What is my savings rate?"
"Can I save ₹10,000 next month?"

**Investments & Goals**
"How are my investments performing?"
"How close am I to my emergency fund goal?"
"What investment should I review?"

**Analysis & Advice**
"Give me a complete financial analysis"
"Compare my spending with last month"
"What should I improve financially?"
"Am I financially healthy?"${personalNote}

Just ask naturally — I'll analyze your real financial data and give you intelligent insights.`,
    intent: 'help',
  };
}

async function handleExpenseSummary(userId, dateInfo, flags, context, currency) {
  const data = context ? null : await getExpenseSummary(userId, dateInfo, currency);
  const expenseData = data || (context ? {
    totalExpenses: context.currentMonth.expenses,
    totalIncome: context.currentMonth.income,
    savings: context.currentMonth.savings,
    savingsRate: context.currentMonth.savingsRate,
    categoryBreakdown: context.currentMonth.categoryBreakdown,
    transactionCount: context.currentMonth.transactionCount,
  } : await getExpenseSummary(userId, dateInfo, currency));

  if (expenseData.totalExpenses === 0 && expenseData.transactionCount === 0) {
    return {
      response: `I don't see any expenses recorded for **${dateInfo.label}**. Start tracking your spending and I'll be able to give you detailed insights and recommendations.`,
      intent: 'expense_summary',
    };
  }

  if (flags.isComparison) {
    const prevMonthStr = getPreviousMonth(dateInfo.monthStr);
    const prevData = await getExpenseSummary(userId, {
      ...getMonthRange(prevMonthStr),
      type: 'single_month',
      monthStr: prevMonthStr,
      label: 'last month',
    }, currency);

    const change = prevData.totalExpenses > 0
      ? Math.round(((expenseData.totalExpenses - prevData.totalExpenses) / prevData.totalExpenses) * 10000) / 100
      : null;
    const changeDir = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'stayed the same';

    let response = `**Expense Comparison — ${dateInfo.label}**\n\n`;
    response += `**This period:** ${fmt(expenseData.totalExpenses, currency)} across ${expenseData.transactionCount} transactions\n`;
    response += `**Previous period (${formatMonthLabel(prevMonthStr)}):** ${fmt(prevData.totalExpenses, currency)}\n\n`;

    if (change !== null) {
      const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
      response += `${changeIcon} Your expenses **${changeDir} by ${Math.abs(change)}%**`;

      if (change > 15) {
        response += `. This is a significant increase — let me highlight where it went up:\n\n`;
      } else if (change < -15) {
        response += `. Nice job reducing spending!\n\n`;
      } else {
        response += `.\n\n`;
      }

      const topIncCategories = [];
      expenseData.categoryBreakdown.forEach(c => {
        const prevCat = prevData.categoryBreakdown.find(pc => pc.category === c.category);
        if (prevCat && c.amount > prevCat.amount) {
          topIncCategories.push({ cat: c.category, diff: Math.round(c.amount - prevCat.amount) });
        }
      });
      if (topIncCategories.length > 0) {
        topIncCategories.sort((a, b) => b.diff - a.diff);
        response += `**Biggest increases:**\n`;
        topIncCategories.slice(0, 3).forEach(c => {
          response += `• ${c.cat}: **+${fmt(c.diff, currency)}**\n`;
        });
      }
    } else {
      response += `No previous data available for comparison.`;
    }

    return { response: response.trim(), intent: 'expense_summary' };
  }

  let response = `**Spending Summary — ${dateInfo.label}**\n\n`;
  response += `You've spent **${fmt(expenseData.totalExpenses, currency)}** across **${expenseData.transactionCount}** transaction${expenseData.transactionCount !== 1 ? 's' : ''}.\n\n`;

  if (expenseData.categoryBreakdown.length > 0) {
    response += `**Top spending categories:**\n`;
    expenseData.categoryBreakdown.slice(0, 5).forEach((c, i) => {
      const bar = '█'.repeat(Math.max(1, Math.round(c.percentage / 8)));
      response += `${i + 1}. **${c.category}**: ${fmt(c.amount, currency)} (${formatPercent(c.percentage)}) ${bar}\n`;
    });
  }

  if (expenseData.totalIncome > 0) {
    response += `\n**Income:** ${fmt(expenseData.totalIncome, currency)} | **Savings Rate:** ${formatPercent(expenseData.savingsRate)}`;
    if (expenseData.savingsRate < 20) {
      response += ` ⚠️`;
    } else if (expenseData.savingsRate >= 30) {
      response += ` ✅`;
    }
  }

  return { response: response.trim(), intent: 'expense_summary' };
}

async function handleExpenseCategory(userId, dateInfo, category, secondaryCategory, flags, context, currency) {
  const expenseData = context ? {
    totalExpenses: context.currentMonth.expenses,
    categoryBreakdown: context.currentMonth.categoryBreakdown,
  } : await getExpenseSummary(userId, dateInfo, currency);

  if (expenseData.categoryBreakdown.length === 0) {
    return {
      response: `No expense data found for **${dateInfo.label}**. Add some expenses to get category-wise analysis.`,
      intent: 'expense_category',
    };
  }

  if (flags.isCombined && secondaryCategory) {
    const cat1 = expenseData.categoryBreakdown.find(c => c.category === category);
    const cat2 = expenseData.categoryBreakdown.find(c => c.category === secondaryCategory);
    const total = (cat1?.amount || 0) + (cat2?.amount || 0);
    return {
      response: `**Combined spending on ${category} and ${secondaryCategory}:**\n\n• ${category}: **${fmt(cat1?.amount || 0, currency)}** (${formatPercent(cat1?.percentage || 0)})\n• ${secondaryCategory}: **${fmt(cat2?.amount || 0, currency)}** (${formatPercent(cat2?.percentage || 0)})\n\n**Total:** ${fmt(total, currency)}`,
      intent: 'expense_category',
    };
  }

  if (category) {
    const catData = expenseData.categoryBreakdown.find(c => c.category === category);
    if (!catData) {
      return {
        response: `No expenses found in **"${category}"** for ${dateInfo.label}. Your expense categories are: ${expenseData.categoryBreakdown.map(c => c.category).join(', ') || 'None recorded yet'}.`,
        intent: 'expense_category',
      };
    }

    let response = `**${category} spending — ${dateInfo.label}**\n\n`;
    response += `You spent **${fmt(catData.amount, currency)}** on ${category}, which is **${formatPercent(catData.percentage)}** of your total expenses (${fmt(expenseData.totalExpenses, currency)}).\n\n`;

    if (catData.percentage > 30) {
      response += `⚠️ This category accounts for over a third of your spending — it might be worth reviewing.`;
    } else if (catData.percentage < 10) {
      response += `✅ This is a relatively small portion of your overall spending.`;
    }

    if (flags.isComparison) {
      const prevMonthStr = getPreviousMonth(dateInfo.monthStr);
      const prevData = await getExpenseSummary(userId, {
        ...getMonthRange(prevMonthStr),
        type: 'single_month',
        monthStr: prevMonthStr,
        label: prevMonthStr,
      }, currency);
      const prevCat = prevData.categoryBreakdown.find(c => c.category === category);
      if (prevCat) {
        const change = prevCat.amount > 0
          ? Math.round(((catData.amount - prevCat.amount) / prevCat.amount) * 10000) / 100
          : null;
        response += `\n\n**vs ${formatMonthLabel(prevMonthStr)}:** ${fmt(prevCat.amount, currency)} → ${fmt(catData.amount, currency)}`;
        if (change !== null) {
          response += ` (**${change > 0 ? '+' : ''}${formatPercent(change)}**)`;
        }
      }
    }

    return { response: response.trim(), intent: 'expense_category' };
  }

  if (flags.isHighest) {
    const top = expenseData.categoryBreakdown[0];
    if (!top) return { response: `No expense data found for ${dateInfo.label}.`, intent: 'expense_category' };
    return {
      response: `**Highest spending category — ${dateInfo.label}**\n\n**${top.category}** at **${fmt(top.amount, currency)}** (${formatPercent(top.percentage)} of total expenses).\n\n${top.percentage > 35 ? '⚠️ This dominates your spending — consider if there are ways to reduce it.' : 'This is your top area but within a reasonable range.'}`,
      intent: 'expense_category',
    };
  }

  if (flags.isLowest) {
    const lowest = expenseData.categoryBreakdown[expenseData.categoryBreakdown.length - 1];
    if (!lowest) return { response: `No expense data found for ${dateInfo.label}.`, intent: 'expense_category' };
    return {
      response: `**Lowest spending category — ${dateInfo.label}**\n\n**${lowest.category}** at **${fmt(lowest.amount, currency)}** (${formatPercent(lowest.percentage)} of total expenses).`,
      intent: 'expense_category',
    };
  }

  let response = `**Expense breakdown — ${dateInfo.label}**\n\n`;
  response += `**Total:** ${fmt(expenseData.totalExpenses, currency)}\n\n`;
  expenseData.categoryBreakdown.forEach((c, i) => {
    const bar = '█'.repeat(Math.max(1, Math.round(c.percentage / 5)));
    response += `${i + 1}. **${c.category}**: ${fmt(c.amount, currency)} (${formatPercent(c.percentage)}) ${bar}\n`;
  });

  return { response: response.trim(), intent: 'expense_category' };
}

async function handleBudgetStatus(userId, dateInfo, category, flags, context, currency) {
  const budgetData = context ? {
    categories: context.budget.categories,
    totalBudget: context.budget.totalBudget,
    totalSpent: context.budget.totalSpent,
    overallPercentUsed: context.budget.overallPercentUsed,
  } : await getBudgetSummary(userId, dateInfo.monthStr, currency);

  if (budgetData.categories.length === 0) {
    return {
      response: `You don't have any budgets set for **${formatMonthLabel(dateInfo.monthStr)}**. Head to the Budget page to set spending limits and I'll track them for you.\n\nSetting budgets helps you stay disciplined and avoid overspending.`,
      intent: 'budget_status',
    };
  }

  if (category) {
    const catBudget = budgetData.categories.find(c => c.category === category);
    if (!catBudget) {
      return {
        response: `No budget set for **"${category}"** in ${formatMonthLabel(dateInfo.monthStr)}. Your budgeted categories are: ${budgetData.categories.map(c => c.category).join(', ')}.`,
        intent: 'budget_status',
      };
    }

    let response = `**${category} Budget — ${formatMonthLabel(dateInfo.monthStr)}**\n\n`;
    response += `• Budget: **${fmt(catBudget.budgetLimit, currency)}**\n`;
    response += `• Spent: **${fmt(catBudget.spent, currency)}** (${formatPercent(catBudget.percentUsed)} used)\n`;
    response += `• Remaining: **${fmt(catBudget.remaining, currency)}**\n`;
    response += `• Status: **${catBudget.status}**\n`;

    if (catBudget.status === 'Exceeded') {
      const overBy = catBudget.spent - catBudget.budgetLimit;
      response += `\n⚠️ You've exceeded this budget by **${fmt(overBy, currency)}**. Consider reducing ${category} spending.`;
    } else if (catBudget.status === 'Warning') {
      response += `\n🟡 You're approaching the limit. Only **${fmt(catBudget.remaining, currency)}** left.`;
    } else {
      response += `\n✅ You're within budget. Keep it up!`;
    }

    return { response: response.trim(), intent: 'budget_status' };
  }

  if (flags.isOverspent) {
    const exceeded = budgetData.categories.filter(c => c.status === 'Exceeded');
    if (exceeded.length === 0) {
      return {
        response: `Great news! 🎉 You haven't exceeded any budget categories in **${formatMonthLabel(dateInfo.monthStr)}**. All categories are within limits.`,
        intent: 'budget_status',
      };
    }
    let response = `**Budget Alert — ${exceeded.length} categor${exceeded.length > 1 ? 'ies' : 'y'} exceeded:**\n\n`;
    exceeded.forEach(c => {
      const overBy = c.spent - c.budgetLimit;
      response += `• **${c.category}**: Spent ${fmt(c.spent, currency)} (over by **${fmt(overBy, currency)}**)\n`;
    });
    response += `\nConsider adjusting your spending in these areas or revising your budgets.`;
    return { response: response.trim(), intent: 'budget_status' };
  }

  if (flags.isComparison) {
    const currentMonthStr = dateInfo.monthStr;
    const prevMonthStr = getPreviousMonth(currentMonthStr);
    const prevBudgetData = await getBudgetSummary(userId, prevMonthStr, currency);

    let response = `**Budget Comparison**\n\n`;
    response += `**This month (${formatMonthLabel(currentMonthStr)}):** ${formatPercent(budgetData.overallPercentUsed)} used (${fmt(budgetData.totalSpent, currency)} of ${fmt(budgetData.totalBudget, currency)})\n`;
    response += `**Last month (${formatMonthLabel(prevMonthStr)}):** ${formatPercent(prevBudgetData.overallPercentUsed)} used (${fmt(prevBudgetData.totalSpent, currency)} of ${fmt(prevBudgetData.totalBudget, currency)})\n\n`;

    return { response: response.trim(), intent: 'budget_status' };
  }

  let response = `**Budget Status — ${formatMonthLabel(dateInfo.monthStr)}**\n\n`;
  response += `**Total Budget:** ${fmt(budgetData.totalBudget, currency)} | **Spent:** ${fmt(budgetData.totalSpent, currency)} | **Remaining:** ${fmt(budgetData.totalBudget - budgetData.totalSpent, currency)}\n`;
  response += `**Overall Usage:** ${formatPercent(budgetData.overallPercentUsed)}\n\n`;

  const exceeded = budgetData.categories.filter(c => c.status === 'Exceeded');
  const warning = budgetData.categories.filter(c => c.status === 'Warning');
  const safe = budgetData.categories.filter(c => c.status === 'Safe');

  if (exceeded.length > 0) {
    response += `🔴 **Exceeded (${exceeded.length}):**\n`;
    exceeded.forEach(c => { response += `  • ${c.category}: ${formatPercent(c.percentUsed)} used\n`; });
  }
  if (warning.length > 0) {
    response += `🟡 **Warning (${warning.length}):**\n`;
    warning.forEach(c => { response += `  • ${c.category}: ${formatPercent(c.percentUsed)} used (${fmt(c.remaining, currency)} left)\n`; });
  }
  if (safe.length > 0) {
    response += `🟢 **On Track (${safe.length}):**\n`;
    safe.forEach(c => { response += `  • ${c.category}: ${formatPercent(c.percentUsed)} used\n`; });
  }

  return { response: response.trim(), intent: 'budget_status' };
}

async function handleSavingsAnalysis(userId, dateInfo, targetAmount, context, currency) {
  const expenseData = context ? {
    totalIncome: context.currentMonth.income,
    totalExpenses: context.currentMonth.expenses,
    savings: context.currentMonth.savings,
    savingsRate: context.currentMonth.savingsRate,
    categoryBreakdown: context.currentMonth.categoryBreakdown,
  } : await getExpenseSummary(userId, dateInfo, currency);

  const healthData = context ? {
    savingsRate: context.health.savingsRate,
    emergencyFund: context.goals.emergencyFund,
  } : await getFinancialHealthData(userId);

  if (expenseData.totalIncome === 0 && expenseData.totalExpenses === 0) {
    return {
      response: `I don't have enough income or expense data for **${dateInfo.label}** to analyze your savings. Please add your income and expenses first.`,
      intent: 'savings_analysis',
    };
  }

  if (targetAmount) {
    const monthsNeeded = expenseData.savings > 0 ? Math.ceil(targetAmount / expenseData.savings) : null;
    let response = `**Savings Target Analysis**\n\n`;
    response += `Based on your current savings of **${fmt(expenseData.savings, currency)}/month**:\n\n`;

    if (monthsNeeded) {
      if (monthsNeeded <= 1) {
        response += `✅ You could save **${fmt(targetAmount, currency)}** in less than a month at your current rate!`;
      } else if (monthsNeeded < 12) {
        response += `It would take approximately **${monthsNeeded} months** to save ${fmt(targetAmount, currency)}.`;
      } else {
        const years = Math.floor(monthsNeeded / 12);
        const remainingMonths = monthsNeeded % 12;
        response += `It would take approximately **${years} year${years > 1 ? 's' : ''}`;
        if (remainingMonths > 0) response += ` and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        response += ` to save ${fmt(targetAmount, currency)}.`;
      }
      response += `\n\nYour current savings rate is **${formatPercent(expenseData.savingsRate)}**.`;
      if (expenseData.savingsRate < 20) {
        response += ` To save faster, try reducing spending on your top categories.`;
      }
    } else {
      response += `You're currently spending more than you earn. Consider reducing expenses first before setting this savings target.`;
    }
    return { response: response.trim(), intent: 'savings_analysis' };
  }

  let response = `**Savings Analysis — ${dateInfo.label}**\n\n`;
  response += `• **Income:** ${fmt(expenseData.totalIncome, currency)}\n`;
  response += `• **Expenses:** ${fmt(expenseData.totalExpenses, currency)}\n`;
  response += `• **Net Savings:** ${fmt(expenseData.savings, currency)}\n`;
  response += `• **Savings Rate:** ${formatPercent(expenseData.savingsRate)}\n\n`;

  if (expenseData.savingsRate >= 30) {
    response += `🌟 **Excellent!** You're saving over 30% of your income. That's outstanding financial discipline. Consider investing the surplus for even better returns.`;
  } else if (expenseData.savingsRate >= 20) {
    response += `👍 **Good savings rate!** You're on track. Consider investing the surplus for better long-term growth.`;
  } else if (expenseData.savingsRate >= 10) {
    response += `⚠️ Your savings rate could be improved. Financial experts recommend saving at least **20%** of income. Review your top spending categories: ${expenseData.categoryBreakdown.slice(0, 3).map(c => c.category).join(', ')}.`;
  } else if (expenseData.savingsRate > 0) {
    response += `⚠️ Your savings rate is quite low at **${formatPercent(expenseData.savingsRate)}**. Try to reduce discretionary spending on: ${expenseData.categoryBreakdown.slice(0, 3).map(c => c.category).join(', ')}.`;
  } else {
    response += `🔴 You're currently spending more than you earn. This is unsustainable. Focus on increasing income or reducing expenses urgently.`;
  }

  if (healthData.emergencyFund) {
    const ef = healthData.emergencyFund;
    const efPct = ef.targetAmount > 0 ? Math.round((ef.savedAmount / ef.targetAmount) * 100) : 0;
    response += `\n\n**Emergency Fund:** ${efPct}% complete (${fmt(ef.savedAmount, currency)} of ${fmt(ef.targetAmount, currency)}).`;
  } else {
    response += `\n\n💡 **Tip:** Consider creating an Emergency Fund goal for financial security. Aim for 6 months of expenses.`;
  }

  return { response: response.trim(), intent: 'savings_analysis' };
}

async function handleInvestmentPerformance(userId, investmentType, flags, context, currency) {
  const data = context ? {
    investments: context.investments.topPerformers.concat(context.investments.underPerformers),
    totalInvested: context.investments.totalInvested,
    totalCurrentValue: context.investments.currentValue,
    totalProfitLoss: context.investments.profitLoss,
    overallROI: context.investments.roi,
    bestPerformer: context.investments.bestPerformer,
    worstPerformer: context.investments.worstPerformer,
    typeAllocation: context.investments.typeAllocation,
    performance: context.investments.topPerformers,
  } : await getInvestmentSummary(userId, currency);

  if (data.investments.length === 0 && data.totalInvested === 0) {
    return {
      response: `Your investment portfolio is currently empty. Start by adding investments in the Investments section to track performance, returns, and portfolio allocation.\n\n💡 **Tip:** Consider starting with SIPs in mutual funds or a PPF for long-term growth.`,
      intent: 'investment_performance',
    };
  }

  if (investmentType) {
    const typeInvestments = data.performance.filter(p => p.type === investmentType);
    if (typeInvestments.length === 0) {
      return {
        response: `No **${investmentType}** investments found in your portfolio. Your investment types are: ${data.typeAllocation.map(t => t.type).join(', ')}.`,
        intent: 'investment_performance',
      };
    }
    const totalInvested = typeInvestments.reduce((s, i) => s + i.amount, 0);
    const totalCurrent = typeInvestments.reduce((s, i) => s + i.currentValue, 0);
    const avgROI = totalInvested > 0 ? Math.round(((totalCurrent - totalInvested) / totalInvested) * 10000) / 100 : 0;

    let response = `**${investmentType} Investments** (${typeInvestments.length})\n\n`;
    typeInvestments.forEach(inv => {
      const profitIcon = inv.profitLoss >= 0 ? '📈' : '📉';
      response += `${profitIcon} **${inv.name}**: ${fmt(inv.amount, currency)} → ${fmt(inv.currentValue, currency)} (${inv.roi >= 0 ? '+' : ''}${formatPercent(inv.roi)})\n`;
    });
    response += `\n**Total Invested:** ${fmt(totalInvested, currency)} | **Current:** ${fmt(totalCurrent, currency)} | **Avg ROI:** ${avgROI >= 0 ? '+' : ''}${formatPercent(avgROI)}`;
    return { response: response.trim(), intent: 'investment_performance' };
  }

  if (flags.isBest) {
    if (!data.bestPerformer) return { response: `No investment data to determine the best performer.`, intent: 'investment_performance' };
    return {
      response: `**Best Performing Investment**\n\n🏆 **${data.bestPerformer.name}** (${data.bestPerformer.type})\n• Invested: ${fmt(data.bestPerformer.amount, currency)}\n• Current Value: ${fmt(data.bestPerformer.currentValue, currency)}\n• ROI: **+${formatPercent(data.bestPerformer.roi)}**\n• Profit: **+${fmt(data.bestPerformer.profitLoss, currency)}**`,
      intent: 'investment_performance',
    };
  }

  if (flags.isWorst) {
    if (!data.worstPerformer) return { response: `No investment data to determine the worst performer.`, intent: 'investment_performance' };
    return {
      response: `**Worst Performing Investment**\n\n📉 **${data.worstPerformer.name}** (${data.worstPerformer.type})\n• Invested: ${fmt(data.worstPerformer.amount, currency)}\n• Current Value: ${fmt(data.worstPerformer.currentValue, currency)}\n• ROI: **${formatPercent(data.worstPerformer.roi)}**\n• Loss: **${fmt(data.worstPerformer.profitLoss, currency)}**`,
      intent: 'investment_performance',
    };
  }

  let response = `**Portfolio Overview** (${data.performance?.length || data.investments?.length || 0} investments)\n\n`;
  response += `• **Total Invested:** ${fmt(data.totalInvested, currency)}\n`;
  response += `• **Current Value:** ${fmt(data.totalCurrentValue, currency)}\n`;
  const profitIcon = data.totalProfitLoss >= 0 ? '📈' : '📉';
  response += `• **Overall P&L:** ${profitIcon} ${data.totalProfitLoss >= 0 ? '+' : ''}${fmt(data.totalProfitLoss, currency)}\n`;
  response += `• **Overall ROI:** ${data.overallROI >= 0 ? '+' : ''}${formatPercent(data.overallROI)}\n\n`;

  if (data.bestPerformer) {
    response += `**Top Performers:**\n`;
    const sorted = [...(data.performance || [])].sort((a, b) => b.roi - a.roi).slice(0, 3);
    sorted.forEach(inv => {
      const icon = inv.profitLoss >= 0 ? '📈' : '📉';
      response += `${icon} **${inv.name}** (${inv.type}): ${inv.roi >= 0 ? '+' : ''}${formatPercent(inv.roi)}\n`;
    });
  }

  if (data.typeAllocation && data.typeAllocation.length > 0) {
    response += `\n**Asset Allocation:**\n`;
    data.typeAllocation.forEach(t => {
      response += `• ${t.type}: ${fmt(t.currentValue, currency)} (${t.count} investment${t.count > 1 ? 's' : ''})\n`;
    });
  }

  return { response: response.trim(), intent: 'investment_performance' };
}

async function handleGoalProgress(userId, goalName, dateInfo, flags, context, currency) {
  const data = context ? {
    goals: context.goals.all,
    activeGoals: context.goals.active,
    achievedGoals: context.goals.achieved,
    overdueGoals: context.goals.overdue,
    totalTarget: context.goals.totalTarget,
    totalSaved: context.goals.totalSaved,
    overallCompletion: context.goals.overallCompletion,
  } : await getGoalSummary(userId);

  if (data.goals.length === 0) {
    return {
      response: `You don't have any financial goals set up yet. Create goals in the Financial Goals section to track your savings progress toward milestones like Emergency Fund, Car Purchase, Vacation, and more.\n\n🎯 **Tip:** Start with an Emergency Fund goal targeting 6 months of expenses.`,
      intent: 'goal_progress',
    };
  }

  if (goalName) {
    const goal = data.goals.find(g =>
      g.goalName.toLowerCase().includes(goalName.toLowerCase()) ||
      g.category.toLowerCase().includes(goalName.toLowerCase())
    );
    if (!goal) {
      const goalNames = data.goals.map(g => g.goalName).join(', ');
      return {
        response: `I couldn't find a goal matching **"${goalName}"**. Your goals are: ${goalNames}.`,
        intent: 'goal_progress',
      };
    }

    let response = `**${goal.goalName}** (${goal.category})\n\n`;
    response += `• **Target:** ${fmt(goal.targetAmount, currency)}\n`;
    response += `• **Saved:** ${fmt(goal.savedAmount, currency)}\n`;
    response += `• **Remaining:** ${fmt(goal.remaining, currency)}\n`;
    response += `• **Progress:** ${formatPercent(goal.completionPercent)}\n`;
    response += `• **Priority:** ${goal.priority}\n`;
    response += `• **Status:** ${goal.status}\n`;

    if (goal.completionPercent >= 75) {
      response += `\n🌟 You're almost there! Keep going!`;
    } else if (goal.completionPercent >= 50) {
      response += `\n👍 You're halfway there. Nice progress!`;
    } else if (goal.completionPercent < 25) {
      response += `\n💡 You're in the early stages. Stay consistent with your savings.`;
    }

    if (goal.estimatedCompletion) {
      const daysLeft = Math.ceil((new Date(goal.estimatedCompletion) - new Date()) / (1000 * 60 * 60 * 24));
      response += `\n• **Estimated Completion:** ${formatDate(goal.estimatedCompletion)}`;
      if (daysLeft > 0) response += ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} from now)`;
    }

    if (goal.monthlySaving > 0 && goal.remaining > 0) {
      response += `\n• **Monthly Saving:** ${fmt(goal.monthlySaving, currency)}`;
      const monthsLeft = Math.ceil(goal.remaining / goal.monthlySaving);
      response += `\n• At this rate, you'll complete it in approximately **${monthsLeft} month${monthsLeft !== 1 ? 's' : ''}**.`;
    }

    return { response: response.trim(), intent: 'goal_progress' };
  }

  let response = `**Goal Progress Summary**\n\n`;
  response += `**Total Goals:** ${data.goals.length} | **Active:** ${data.activeGoals.length} | **Achieved:** ${data.achievedGoals.length} | **Overdue:** ${data.overdueGoals.length}\n`;
  response += `**Overall Completion:** ${formatPercent(data.overallCompletion)}\n`;
  response += `**Total Saved:** ${fmt(data.totalSaved, currency)} of ${fmt(data.totalTarget, currency)}\n\n`;

  data.goals.forEach(g => {
    const icon = g.status === 'achieved' ? '✅' : g.status === 'overdue' ? '🔴' : g.status === 'paused' ? '⏸️' : '🔵';
    response += `${icon} **${g.goalName}**: ${formatPercent(g.completionPercent)} (${fmt(g.savedAmount, currency)}/${fmt(g.targetAmount, currency)})`;
    if (g.estimatedCompletion && g.status === 'active') {
      const daysLeft = Math.ceil((new Date(g.estimatedCompletion) - new Date()) / (1000 * 60 * 60 * 24));
      response += ` — Est. ${formatDate(g.estimatedCompletion)}`;
      if (daysLeft > 0) response += ` (${daysLeft}d left)`;
    }
    response += '\n';
  });

  return { response: response.trim(), intent: 'goal_progress' };
}

async function handleFinancialReport(userId, dateInfo, flags, context, currency) {
  if (context) {
    let response = `**Complete Financial Analysis — ${context.currentMonth.label}**\n\n`;

    response += `**Income & Expenses**\n`;
    response += `• Income: **${fmt(context.currentMonth.income, currency)}**\n`;
    response += `• Expenses: **${fmt(context.currentMonth.expenses, currency)}**\n`;
    response += `• Net Savings: **${fmt(context.currentMonth.savings, currency)}**\n`;
    response += `• Savings Rate: **${formatPercent(context.currentMonth.savingsRate)}**\n`;
    response += `• Transactions: **${context.currentMonth.transactionCount}**\n\n`;

    if (context.currentMonth.highestCategory) {
      response += `**Top Spending:** ${context.currentMonth.highestCategory.category} at ${fmt(context.currentMonth.highestCategory.amount, currency)}\n\n`;
    }

    if (context.changes.expenseChange !== null) {
      const dir = context.changes.expenseChange > 0 ? '📈 increased' : '📉 decreased';
      response += `**Month-over-Month:** Expenses ${dir} by ${Math.abs(context.changes.expenseChange)}%\n\n`;
    }

    if (context.budget.totalBudget > 0) {
      response += `**Budget:** ${formatPercent(context.budget.overallPercentUsed)} used`;
      if (context.budget.exceededCount > 0) {
        response += ` (${context.budget.exceededCount} exceeded)`;
      }
      response += '\n\n';
    }

    if (context.investments.totalInvested > 0) {
      response += `**Investments:** ${fmt(context.investments.totalInvested, currency)} → ${fmt(context.investments.currentValue, currency)} (${context.investments.roi >= 0 ? '+' : ''}${formatPercent(context.investments.roi)})\n\n`;
    }

    if (context.goals.active.length > 0) {
      response += `**Active Goals:** ${context.goals.active.length}\n`;
      context.goals.active.slice(0, 3).forEach(g => {
        response += `• ${g.name}: ${formatPercent(g.completion)}\n`;
      });
      response += '\n';
    }

    response += `**Financial Health:** ${context.health.score}/100 (${context.health.status})\n`;

    if (context.anomalies.length > 0) {
      response += `\n**Alerts:**\n`;
      context.anomalies.slice(0, 3).forEach(a => {
        response += `• ${a.message}\n`;
      });
    }

    if (context.insights.length > 0) {
      response += `\n**Insights:**\n`;
      context.insights.slice(0, 3).forEach(i => {
        response += `• ${i.message}\n`;
      });
    }

    return { response: response.trim(), intent: 'financial_report' };
  }

  const [expenseData, budgetData, investmentData, goalData] = await Promise.all([
    getExpenseSummary(userId, dateInfo, currency),
    getBudgetSummary(userId, dateInfo.monthStr, currency),
    getInvestmentSummary(userId, currency),
    getGoalSummary(userId),
  ]);

  let response = `**Financial Report — ${dateInfo.label}**\n\n`;

  response += `**Income & Expenses**\n`;
  response += `• Income: **${fmt(expenseData.totalIncome, currency)}**\n`;
  response += `• Expenses: **${fmt(expenseData.totalExpenses, currency)}**\n`;
  response += `• Net: **${fmt(expenseData.savings, currency)}**\n`;
  response += `• Savings Rate: **${formatPercent(expenseData.savingsRate)}**\n`;
  response += `• Transactions: **${expenseData.transactionCount}**\n\n`;

  if (expenseData.categoryBreakdown.length > 0) {
    response += `**Top Spending Categories**\n`;
    expenseData.categoryBreakdown.slice(0, 5).forEach((c, i) => {
      response += `${i + 1}. ${c.category}: **${fmt(c.amount, currency)}** (${formatPercent(c.percentage)})\n`;
    });
    response += '\n';
  }

  if (budgetData.categories.length > 0) {
    response += `**Budget Status**\n`;
    budgetData.categories.forEach(c => {
      const icon = c.status === 'Exceeded' ? '🔴' : c.status === 'Warning' ? '🟡' : '🟢';
      response += `${icon} ${c.category}: ${formatPercent(c.percentUsed)} used\n`;
    });
    response += '\n';
  }

  if (investmentData.investments.length > 0) {
    response += `**Investments**\n`;
    response += `• Total Invested: **${fmt(investmentData.totalInvested, currency)}**\n`;
    response += `• Current Value: **${fmt(investmentData.totalCurrentValue, currency)}**\n`;
    response += `• ROI: **${investmentData.overallROI >= 0 ? '+' : ''}${formatPercent(investmentData.overallROI)}**\n\n`;
  }

  if (goalData.goals.length > 0) {
    response += `**Goals**\n`;
    goalData.goals.forEach(g => {
      const icon = g.status === 'achieved' ? '✅' : g.status === 'overdue' ? '🔴' : '🔵';
      response += `${icon} ${g.goalName}: ${formatPercent(g.completionPercent)}\n`;
    });
  }

  return { response: response.trim(), intent: 'financial_report' };
}

async function handleAdvice(userId, rawQuery, context, sentiment, currency) {
  const q = rawQuery.toLowerCase();

  if (context) {
    let response = `**Personalized Financial Advice**\n\n`;
    let adviceCount = 0;

    if (context.health.savingsRate < 20) {
      const gap = Math.round(context.currentMonth.income * 0.2 - context.currentMonth.savings);
      response += `${++adviceCount}. **Increase Savings:** Your savings rate is ${formatPercent(context.health.savingsRate)}. Aim for 20-30%. `;
      if (gap > 0) response += `Try to save an additional **${fmt(gap, currency)}** per month.`;
      response += '\n\n';
    }

    if (context.health.expenseRatio > 70) {
      response += `${++adviceCount}. **Reduce Expenses:** You're spending ${formatPercent(context.health.expenseRatio)} of income. `;
      const topCats = context.currentMonth.topSpendingCategories.slice(0, 2);
      if (topCats.length > 0) {
        response += `Focus on: ${topCats.map(c => c.category).join(', ')}.`;
      }
      response += '\n\n';
    }

    if (context.investments.totalInvested === 0) {
      response += `${++adviceCount}. **Start Investing:** You have no investments yet. Consider SIPs in mutual funds or PPF for long-term growth.\n\n`;
    } else if (context.investments.underPerformers && context.investments.underPerformers.length > 0) {
      response += `${++adviceCount}. **Review Underperformers:** ${context.investments.underPerformers.length} investment(s) showing losses. Consider rebalancing.\n\n`;
    }

    if (!context.goals.emergencyFund) {
      response += `${++adviceCount}. **Emergency Fund:** Create an emergency fund goal targeting 6 months of expenses (${fmt(context.currentMonth.expenses * 6, currency)}).\n\n`;
    } else if (context.goals.emergencyFund.completion < 50) {
      response += `${++adviceCount}. **Build Emergency Fund:** Your fund is only ${formatPercent(context.goals.emergencyFund.completion)} complete. Prioritize building it.\n\n`;
    }

    if (context.budget.exceededCount > 0) {
      response += `${++adviceCount}. **Fix Budget Overruns:** ${context.budget.exceededCount} budget${context.budget.exceededCount > 1 ? 's' : ''} exceeded. Review your spending limits.\n\n`;
    }

    if (adviceCount === 0) {
      response += `Your finances look well-managed! Here are some ways to optimize further:\n\n`;
      response += `• Consider diversifying your investments across asset classes\n`;
      response += `• Review your emergency fund target — 6 months of expenses is recommended\n`;
      response += `• Look into tax-saving investments like PPF or ELSS\n`;
    }

    response += `\n**Overall Health Score:** ${context.health.score}/100 (${context.health.status})`;
    return { response: response.trim(), intent: 'advice' };
  }

  const health = await getFinancialHealthData(userId);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const expenseData = await getExpenseSummary(userId, {
    ...getMonthRange(currentMonth),
    type: 'single_month',
    monthStr: currentMonth,
    label: 'this month',
  }, currency);

  let response = `**Personalized Financial Advice**\n\n`;
  let adviceCount = 0;

  if (/\b(spending\s+too\s+much|spending\s+high|overspending|spending\s+habit)\b/.test(q)) {
    response += `**Spending Analysis:**\n`;
    response += `You've spent **${fmt(expenseData.totalExpenses, currency)}** this month against **${fmt(expenseData.totalIncome, currency)}** income.\n`;
    if (expenseData.categoryBreakdown.length > 0) {
      response += `Top spending areas: ${expenseData.categoryBreakdown.slice(0, 3).map(c => `${c.category} (${fmt(c.amount, currency)})`).join(', ')}.\n`;
    }
    response += '\n';
  }

  if (health.savingsRate < 20) {
    response += `${++adviceCount}. **Increase Savings:** Your savings rate is ${formatPercent(health.savingsRate)}. Aim for 20-30% by reducing discretionary spending.\n`;
  }
  if (health.expenseRatio > 70) {
    response += `${++adviceCount}. **Reduce Expenses:** You're spending ${formatPercent(health.expenseRatio)} of income. Focus on the biggest expense categories.\n`;
  }
  if (health.totalInvested === 0) {
    response += `${++adviceCount}. **Start Investing:** You have no investments yet. Consider SIPs in mutual funds or PPF.\n`;
  }
  if (!health.emergencyFund) {
    response += `${++adviceCount}. **Emergency Fund:** Create an emergency fund goal targeting 6 months of expenses.\n`;
  }
  if (health.emergencyFund && health.emergencyFund.targetAmount > 0) {
    const efPct = Math.round((health.emergencyFund.savedAmount / health.emergencyFund.targetAmount) * 100);
    if (efPct < 50) {
      response += `${++adviceCount}. **Build Emergency Fund:** Your fund is only ${efPct}% complete.\n`;
    }
  }

  if (adviceCount === 0) {
    response += `Your finances look well-managed! Consider diversifying investments and reviewing your emergency fund target.\n`;
  }

  response += `\n**Health Score:** ${health.score}/100 (${health.status})`;
  return { response: response.trim(), intent: 'advice' };
}

async function handleFinancialHealth(userId, rawQuery, context, currency) {
  if (context) {
    let response = `**Financial Health Score: ${context.health.score}/100 (${context.health.status})**\n\n`;

    response += `**Key Indicators:**\n`;
    response += `• Savings Rate: **${formatPercent(context.health.savingsRate)}**\n`;
    response += `• Expense Ratio: **${formatPercent(context.health.expenseRatio)}**\n`;
    response += `• Investment Growth: **${formatPercent(context.health.investmentGrowth)}**\n`;
    response += `• Debt-to-Income: **${formatPercent(context.health.debtToIncome)}**\n`;
    response += `• Goals: **${context.goals.achieved.length}/${context.goals.all.length}** achieved\n\n`;

    if (context.health.savingsRate >= 30) {
      response += `✅ Your savings rate is excellent.\n`;
    } else if (context.health.savingsRate < 20) {
      response += `⚠️ Your savings rate needs improvement — aim for 20%+.\n`;
    }

    if (context.health.expenseRatio > 80) {
      response += `⚠️ Your expenses are high relative to income.\n`;
    } else if (context.health.expenseRatio < 60) {
      response += `✅ Your expense ratio is well controlled.\n`;
    }

    if (context.goals.emergencyFund) {
      const efPct = context.goals.emergencyFund.completion;
      if (efPct < 50) {
        response += `⚠️ Emergency Fund is only ${formatPercent(efPct)} — prioritize building it.\n`;
      }
    } else {
      response += `⚠️ No Emergency Fund found — create one for financial security.\n`;
    }

    if (context.anomalies.length > 0) {
      response += `\n**Areas needing attention:**\n`;
      context.anomalies.slice(0, 3).forEach(a => {
        response += `• ${a.message}\n`;
      });
    }

    return { response: response.trim(), intent: 'financial_health' };
  }

  const health = await getFinancialHealthData(userId);

  let response = `**Financial Health Overview**\n\n`;
  response += `**Score:** ${health.score}/100 (${health.status})\n`;
  response += `• Savings Rate: **${formatPercent(health.savingsRate)}**\n`;
  response += `• Expense Ratio: **${formatPercent(health.expenseRatio)}**\n`;
  response += `• Total Income: **${fmt(health.totalIncome, currency)}**\n`;
  response += `• Total Expenses: **${fmt(health.totalExpenses, currency)}**\n`;
  response += `• Net Savings: **${fmt(health.savings, currency)}**\n`;
  if (health.totalInvested > 0) {
    response += `• Investments: **${fmt(health.totalInvested, currency)}** → **${fmt(health.totalCurrentValue, currency)}** (${health.investmentGrowth >= 0 ? '+' : ''}${formatPercent(health.investmentGrowth)})\n`;
  }
  response += `• Goals: **${health.activeGoals}** active, **${health.achievedGoals}** achieved\n`;

  if (health.savingsRate < 20) response += `\n⚠️ Try to save at least 20% of your income.`;
  if (health.expenseRatio > 80) response += `\n⚠️ Your spending is high relative to income.`;

  return { response: response.trim(), intent: 'financial_health' };
}

async function handleMultiIntent(userId, intent, dateInfo, context, currency) {
  try {
    switch (intent) {
      case 'expense_summary':
        return await handleExpenseSummary(userId, dateInfo, { isComparison: false, isHighest: false, isLowest: false, isBest: false, isWorst: false, isAll: false, isRemaining: false, isOverspent: false, isCombined: false, isMultipleCategories: false }, context, currency);
      case 'budget_status':
        return await handleBudgetStatus(userId, dateInfo, null, { isComparison: false, isHighest: false, isLowest: false, isBest: false, isWorst: false, isAll: false, isRemaining: false, isOverspent: false, isCombined: false, isMultipleCategories: false }, context, currency);
      case 'savings_analysis':
        return await handleSavingsAnalysis(userId, dateInfo, null, context, currency);
      case 'financial_health':
        return await handleFinancialHealth(userId, '', context, currency);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function handleContextualFallback(userId, rawQuery, context, sentiment, currency) {
  const q = rawQuery.toLowerCase();

  const intentKeywords = {
    expense: 'expense_summary', spending: 'expense_summary', spend: 'expense_summary', spent: 'expense_summary', cost: 'expense_summary',
    budget: 'budget_status', budgets: 'budget_status',
    saving: 'savings_analysis', savings: 'savings_analysis', save: 'savings_analysis',
    invest: 'investment_performance', investment: 'investment_performance', portfolio: 'investment_performance', returns: 'investment_performance',
    goal: 'goal_progress', goals: 'goal_progress', target: 'goal_progress', fund: 'goal_progress', emergency: 'goal_progress',
    income: 'financial_report', salary: 'financial_report', earning: 'financial_report',
    health: 'financial_health', financial: 'financial_health', money: 'financial_health',
    improve: 'advice', better: 'advice', advice: 'advice', recommend: 'advice', suggest: 'advice',
  };

  let matchedIntent = null;
  for (const [word, intent] of Object.entries(intentKeywords)) {
    if (q.includes(word)) {
      matchedIntent = intent;
      break;
    }
  }

  if (matchedIntent) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateInfo = {
      type: 'single_month',
      ...getMonthRange(currentMonth),
      label: 'this month',
      monthStr: currentMonth,
    };

    const defaultFlags = { isComparison: false, isHighest: false, isLowest: false, isBest: false, isWorst: false, isAll: false, isRemaining: false, isOverspent: false, isCombined: false, isMultipleCategories: false };

    switch (matchedIntent) {
      case 'expense_summary':
        return await handleExpenseSummary(userId, dateInfo, defaultFlags, context, currency);
      case 'budget_status':
        return await handleBudgetStatus(userId, dateInfo, null, defaultFlags, context, currency);
      case 'savings_analysis':
        return await handleSavingsAnalysis(userId, dateInfo, null, context, currency);
      case 'investment_performance':
        return await handleInvestmentPerformance(userId, null, defaultFlags, context, currency);
      case 'goal_progress':
        return await handleGoalProgress(userId, null, dateInfo, defaultFlags, context, currency);
      case 'financial_report':
        return await handleFinancialReport(userId, dateInfo, defaultFlags, context, currency);
      case 'financial_health':
        return await handleFinancialHealth(userId, rawQuery, context, currency);
      case 'advice':
        return await handleAdvice(userId, rawQuery, context, sentiment, currency);
    }
  }

  const history = getConversationHistory(userId);

  if (context) {
    let response = `I'm not entirely sure what you're asking, but based on your current financial data:\n\n`;
    response += `• **Health Score:** ${context.health.score}/100 (${context.health.status})\n`;
    response += `• **Savings Rate:** ${formatPercent(context.currentMonth.savingsRate)}\n`;
    response += `• **Monthly Expenses:** ${fmt(context.currentMonth.expenses, currency)}\n`;

    if (context.anomalies.length > 0) {
      response += `\n**Alert:** ${context.anomalies[0].message}`;
    }

    response += `\n\nTry asking about specific topics like expenses, budgets, savings, investments, or goals.`;
    return { response: response.trim(), intent: 'unknown' };
  }

  return {
    response: `I'm JARVIS, your AI financial assistant. I can help you analyze expenses, budgets, savings, investments, goals, and more.\n\nTry asking something like:\n• "How much did I spend this month?"\n• "What is my financial health score?"\n• "Where am I wasting money?"`,
    intent: 'unknown',
  };
}

async function handleUnknown(rawQuery, context) {
  if (context) {
    return {
      response: `I'm not sure how to interpret that, but here's a quick snapshot of your finances:\n\n• **Health Score:** ${context.health.score}/100 (${context.health.status})\n• **Savings Rate:** ${formatPercent(context.currentMonth.savingsRate)}\n• **Monthly Expenses:** ${fmt(context.currentMonth.expenses, 'INR')}\n\nFeel free to ask about any specific area!`,
      intent: 'unknown',
    };
  }

  return {
    response: `I'm JARVIS, your AI financial assistant. I can help you analyze expenses, budgets, savings, investments, goals, and more. What would you like to check today?`,
    intent: 'unknown',
  };
}

module.exports = { processQuery, getConversationHistory };
