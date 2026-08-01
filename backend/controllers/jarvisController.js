const asyncHandler = require('../middleware/asyncHandler');
const { processQuery } = require('../services/jarvisService');

const chat = asyncHandler(async (req, res) => {
  const query = req.body.message || req.body.query;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (query.trim().length > 500) {
    return res.status(400).json({ error: 'Message too long. Please keep it under 500 characters.' });
  }

  try {
    const result = await processQuery(req.userId, query.trim());
    res.json({
      response: result.response,
      intent: result.intent,
      suggestions: result.suggestions || [],
    });
  } catch (err) {
    console.error('[JARVIS CONTROLLER] Error:', err.message);
    res.json({
      response: 'I encountered an unexpected error while processing your request. Please try again or rephrase your question.',
      intent: 'error',
      suggestions: [
        { text: 'How much did I spend this month?', icon: '💳' },
        { text: 'What is my financial health score?', icon: '❤️' },
        { text: 'Show my budget status', icon: '📊' },
      ],
    });
  }
});

module.exports = { chat };
