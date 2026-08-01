const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-flash-latest';

const SYSTEM_PROMPT = `You are JARVIS — an elite AI financial assistant built into the Smart Finance Insights app. You speak like a sharp, friendly financial advisor. You have access to the user's real financial data (expenses, income, budgets, investments, goals) which will be provided in the prompt context.

RULES:
- Always respond in concise, structured Markdown (use **bold**, bullet points, numbered lists).
- Use Indian Rupee (₹) formatting for all currency values.
- If real financial data is provided, use it directly in your analysis. Never make up numbers.
- If no financial data is provided, give general financial education/advice.
- Be direct, actionable, and data-driven. No filler words.
- Keep responses under 400 words unless the user asks for detail.
- You can discuss ANY topic — finance, life, motivation, general knowledge — but always tie back to finance when possible.
- If the user asks something completely unrelated to finance, still answer helpfully but add a brief finance tip at the end.`;

async function chatWithGemini(userMessage, conversationHistory = [], financialContext = null) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[GEMINI] No API key configured');
      return null;
    }

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT,
    });

    const history = (conversationHistory || []).slice(-8).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    let enrichedMessage = userMessage;
    if (financialContext) {
      enrichedMessage = `[USER'S FINANCIAL DATA]\n${financialContext}\n\n[USER'S QUESTION]\n${userMessage}`;
    }

    const result = await chat.sendMessage(enrichedMessage);
    return result.response.text();
  } catch (error) {
    console.error('[GEMINI] Error:', error.message);
    return null;
  }
}

function formatFinancialContext(context) {
  if (!context) return null;

  const lines = [];
  lines.push(`Health Score: ${context.health?.score || 'N/A'}/100 (${context.health?.status || 'N/A'})`);
  lines.push(`Savings Rate: ${context.health?.savingsRate || 'N/A'}%`);
  lines.push(`Expense Ratio: ${context.health?.expenseRatio || 'N/A'}%`);

  if (context.currentMonth) {
    lines.push(`Monthly Income: ₹${context.currentMonth.income || 0}`);
    lines.push(`Monthly Expenses: ₹${context.currentMonth.expenses || 0}`);
    lines.push(`Net Savings: ₹${context.currentMonth.savings || 0}`);
    if (context.currentMonth.highestCategory) {
      lines.push(`Top Spending: ${context.currentMonth.highestCategory.category} (₹${context.currentMonth.highestCategory.amount})`);
    }
    if (context.currentMonth.categoryBreakdown?.length > 0) {
      lines.push(`Categories: ${context.currentMonth.categoryBreakdown.map(c => `${c.category}=₹${c.amount}(${Math.round(c.percentage)}%)`).join(', ')}`);
    }
  }

  if (context.budget && context.budget.totalBudget > 0) {
    lines.push(`Budget: ₹${context.budget.totalSpent}/₹${context.budget.totalBudget} used (${Math.round(context.budget.overallPercentUsed)}%)`);
    if (context.budget.exceededCount > 0) lines.push(`Exceeded Budgets: ${context.budget.exceededCount}`);
  }

  if (context.investments && context.investments.totalInvested > 0) {
    lines.push(`Investments: ₹${context.investments.totalInvested} → ₹${context.investments.currentValue} (ROI: ${context.investments.roi >= 0 ? '+' : ''}${context.investments.roi}%)`);
    if (context.investments.bestPerformer) lines.push(`Best: ${context.investments.bestPerformer.name} (+${context.investments.bestPerformer.roi}%)`);
    if (context.investments.worstPerformer) lines.push(`Worst: ${context.investments.worstPerformer.name} (${context.investments.worstPerformer.roi}%)`);
  }

  if (context.goals) {
    lines.push(`Goals: ${context.goals.active?.length || 0} active, ${context.goals.achieved?.length || 0} achieved, ${context.goals.overdue?.length || 0} overdue`);
    if (context.goals.active?.length > 0) {
      context.goals.active.slice(0, 3).forEach(g => {
        lines.push(`  - ${g.name || g.goalName}: ${g.completionPercent || Math.round((g.savedAmount / g.targetAmount) * 100)}% complete`);
      });
    }
    if (context.goals.emergencyFund) {
      lines.push(`Emergency Fund: ${context.goals.emergencyFund.completion}% complete`);
    }
  }

  if (context.anomalies?.length > 0) {
    lines.push(`Alerts: ${context.anomalies.map(a => a.message).join('; ')}`);
  }

  if (context.insights?.length > 0) {
    lines.push(`Insights: ${context.insights.map(i => i.message).join('; ')}`);
  }

  return lines.join('\n');
}

module.exports = {
  chatWithGemini,
  formatFinancialContext,
};
