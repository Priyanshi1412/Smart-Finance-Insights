from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app, origins=['http://localhost:4000', 'http://localhost:3000'])


def validate_monthly_data(data):
    """Validate and extract monthly financial data from request."""
    if not data or not isinstance(data, dict):
        return None, 'Request body must be a JSON object'

    monthly = data.get('monthly', [])
    if not isinstance(monthly, list) or len(monthly) == 0:
        return None, 'monthly must be a non-empty array of {month, income, expenses, savings}'

    cleaned = []
    for i, entry in enumerate(monthly):
        if not isinstance(entry, dict):
            return None, f'monthly[{i}] must be an object'
        income = entry.get('income', 0)
        expenses = entry.get('expenses', 0)
        savings = entry.get('savings', 0)
        month = entry.get('month', '')
        for val in [income, expenses, savings]:
            if not isinstance(val, (int, float)):
                return None, f'monthly[{i}] values must be numbers'
        cleaned.append({
            'month': str(month),
            'income': float(income),
            'expenses': float(expenses),
            'savings': float(savings),
        })

    return cleaned, None


def build_time_series(data, key):
    """Extract a numeric time series from cleaned monthly data."""
    return np.array([entry[key] for entry in data], dtype=float)


def fit_predict_trend(series, steps=1):
    """Fit linear regression and predict next N steps. Returns (predictions, slope)."""
    if len(series) < 2:
        return [float(series[-1])] * steps if len(series) == 1 else [0.0] * steps, 0.0

    X = np.arange(len(series)).reshape(-1, 1)
    y = series

    # Simple linear regression without sklearn dependency
    X_mean = X.mean()
    y_mean = y.mean()
    numerator = ((X - X_mean) * (y - y_mean)).sum()
    denominator = ((X - X_mean) ** 2).sum()

    if denominator == 0:
        return [float(y_mean)] * steps, 0.0

    slope = numerator / denominator
    intercept = y_mean - slope * X_mean

    future_X = np.arange(len(series), len(series) + steps).reshape(-1, 1)
    predictions = (slope * future_X + intercept).flatten()

    # Floor at 0 for financial values
    predictions = np.maximum(predictions, 0)

    return predictions.tolist(), float(slope)


def calculate_trend(series):
    """Determine trend direction from a series."""
    if len(series) < 2:
        return 'stable', 0.0
    recent = series[-1]
    previous = series[-2]
    if previous == 0:
        return ('increasing' if recent > 0 else 'stable'), 0.0
    pct_change = ((recent - previous) / abs(previous)) * 100
    if pct_change > 5:
        return 'increasing', round(float(pct_change), 1)
    elif pct_change < -5:
        return 'decreasing', round(float(pct_change), 1)
    return 'stable', round(float(pct_change), 1)


def compute_financial_health(income_series, expense_series, savings_series):
    """Compute a financial health score (0-100) and breakdown."""
    total_income = float(income_series.sum())
    total_expenses = float(expense_series.sum())
    total_savings = float(savings_series.sum())

    if total_income == 0:
        return {
            'score': 20,
            'status': 'Critical',
            'breakdown': {
                'savingsRate': 0,
                'expenseControl': 0,
                'incomeGrowth': 0,
                'consistency': 0,
            }
        }

    savings_rate = (total_savings / total_income) * 100 if total_income > 0 else 0
    expense_ratio = total_expenses / total_income if total_income > 0 else 1

    # Savings rate score (0-35)
    sr_score = min(35, max(0, savings_rate * 1.75))

    # Expense control score (0-30)
    ec_score = max(0, 30 * (1 - max(0, expense_ratio - 0.5) * 2))

    # Income growth score (0-20)
    ig_score = 10.0
    if len(income_series) >= 2:
        inc_trend, inc_pct = calculate_trend(income_series)
        if inc_trend == 'increasing':
            ig_score = min(20, 10 + abs(inc_pct) * 0.5)
        elif inc_trend == 'decreasing':
            ig_score = max(0, 10 - abs(inc_pct) * 0.5)

    # Consistency score (0-15)
    if len(savings_series) >= 2:
        positive_months = sum(1 for s in savings_series if s > 0)
        cs_score = (positive_months / len(savings_series)) * 15
    else:
        cs_score = 7.5

    total_score = round(sr_score + ec_score + ig_score + cs_score)
    total_score = max(0, min(100, total_score))

    if total_score >= 80:
        status = 'Excellent'
    elif total_score >= 60:
        status = 'Good'
    elif total_score >= 40:
        status = 'Fair'
    else:
        status = 'Needs Improvement'

    return {
        'score': total_score,
        'status': status,
        'breakdown': {
            'savingsRate': round(sr_score, 1),
            'expenseControl': round(ec_score, 1),
            'incomeGrowth': round(ig_score, 1),
            'consistency': round(cs_score, 1),
        }
    }


def generate_recommendations(data, predictions, health_result):
    """Generate actionable recommendations based on data and predictions."""
    recs = []

    income_series = build_time_series(data, 'income')
    expense_series = build_time_series(data, 'expenses')
    savings_series = build_time_series(data, 'savings')

    total_income = float(income_series.sum())
    total_expenses = float(expense_series.sum())
    total_savings = float(savings_series.sum())

    if total_income > 0:
        savings_rate = (total_savings / total_income) * 100
        if savings_rate < 20:
            gap = total_income * 0.2 - total_savings
            recs.append({
                'type': 'savings',
                'priority': 'high',
                'title': 'Increase savings rate',
                'message': f'Your savings rate is {savings_rate:.1f}%. Aim for at least 20% by saving an additional {abs(gap):.0f} per period.',
            })
        elif savings_rate >= 40:
            recs.append({
                'type': 'invest',
                'priority': 'low',
                'title': 'Consider investing surplus',
                'message': f'At {savings_rate:.1f}% savings rate, consider investing in SIPs or index funds to grow wealth.',
            })

    if len(expense_series) >= 2:
        exp_trend, exp_pct = calculate_trend(expense_series)
        if exp_trend == 'increasing' and abs(exp_pct) > 10:
            recs.append({
                'type': 'expense',
                'priority': 'high',
                'title': 'Expenses rising',
                'message': f'Expenses increased by {abs(exp_pct):.1f}%. Review spending in top categories to control growth.',
            })
        elif exp_trend == 'decreasing':
            recs.append({
                'type': 'expense',
                'priority': 'low',
                'title': 'Good expense discipline',
                'message': f'Expenses decreased by {abs(exp_pct):.1f}%. Keep maintaining this trend.',
            })

    if len(income_series) >= 2:
        inc_trend, inc_pct = calculate_trend(income_series)
        if inc_trend == 'decreasing' and abs(inc_pct) > 10:
            recs.append({
                'type': 'income',
                'priority': 'high',
                'title': 'Income declining',
                'message': f'Income dropped {abs(inc_pct):.1f}%. Consider diversifying income sources.',
            })

    if health_result['score'] < 50:
        recs.append({
            'type': 'health',
            'priority': 'high',
            'title': 'Financial health needs attention',
            'message': f'Your health score is {health_result["score"]}/100. Focus on building an emergency fund and reducing unnecessary expenses.',
        })

    if predictions.get('predictedSavingsNextMonth', 0) < 0:
        recs.append({
            'type': 'alert',
            'priority': 'high',
            'title': 'Negative savings predicted',
            'message': 'Next month may see negative savings. Consider cutting discretionary spending.',
        })

    if not recs:
        recs.append({
            'type': 'general',
            'priority': 'low',
            'title': 'Finances look stable',
            'message': 'No critical issues detected. Keep maintaining your current financial habits.',
        })

    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    recs.sort(key=lambda r: priority_order.get(r['priority'], 3))

    return recs[:8]


# ─── Routes ───────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'smart-finance-ml', 'version': '1.0.0'})


@app.route('/predict/savings', methods=['POST'])
def predict_savings():
    data, error = validate_monthly_data(request.json)
    if error:
        return jsonify({'error': error}), 400

    savings = build_time_series(data, 'savings')
    predicted, slope = fit_predict_trend(savings, steps=1)
    trend, trend_pct = calculate_trend(savings)

    return jsonify({
        'predictedSavingsNextMonth': round(predicted[0], 2),
        'trend': trend,
        'trendChangePercent': trend_pct,
        'slope': round(slope, 4),
        'dataPoints': len(savings),
    })


@app.route('/predict/expenses', methods=['POST'])
def predict_expenses():
    data, error = validate_monthly_data(request.json)
    if error:
        return jsonify({'error': error}), 400

    expenses = build_time_series(data, 'expenses')
    predicted, slope = fit_predict_trend(expenses, steps=1)
    trend, trend_pct = calculate_trend(expenses)

    avg_expenses = float(expenses.mean()) if len(expenses) > 0 else 0

    return jsonify({
        'predictedExpensesNextMonth': round(predicted[0], 2),
        'trend': trend,
        'trendChangePercent': trend_pct,
        'averageMonthlyExpenses': round(avg_expenses, 2),
        'slope': round(slope, 4),
        'dataPoints': len(expenses),
    })


@app.route('/predict/financial-health', methods=['POST'])
def predict_financial_health():
    data, error = validate_monthly_data(request.json)
    if error:
        return jsonify({'error': error}), 400

    income = build_time_series(data, 'income')
    expenses = build_time_series(data, 'expenses')
    savings = build_time_series(data, 'savings')

    health_result = compute_financial_health(income, expenses, savings)

    # Predict next month's savings for forward-looking insight
    predicted_savings, _ = fit_predict_trend(savings, steps=1)

    # Predict health trajectory
    health_history = []
    for i in range(2, len(data) + 1):
        h = compute_financial_health(income[:i], expenses[:i], savings[:i])
        health_history.append(h['score'])

    health_trend = 'stable'
    if len(health_history) >= 2:
        health_trend, _ = calculate_trend(np.array(health_history, dtype=float))

    return jsonify({
        'currentScore': health_result['score'],
        'status': health_result['status'],
        'breakdown': health_result['breakdown'],
        'predictedSavingsNextMonth': round(predicted_savings[0], 2),
        'healthTrend': health_trend,
        'dataPoints': len(data),
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    """Full analysis endpoint — returns predictions, health, and recommendations."""
    data, error = validate_monthly_data(request.json)
    if error:
        return jsonify({'error': error}), 400

    income = build_time_series(data, 'income')
    expenses = build_time_series(data, 'expenses')
    savings = build_time_series(data, 'savings')

    # Savings prediction
    pred_savings, _ = fit_predict_trend(savings, steps=1)
    sav_trend, sav_pct = calculate_trend(savings)

    # Expense prediction
    pred_expenses, _ = fit_predict_trend(expenses, steps=1)
    exp_trend, exp_pct = calculate_trend(expenses)

    # Income trend
    inc_trend, inc_pct = calculate_trend(income)

    # Financial health
    health_result = compute_financial_health(income, expenses, savings)

    predictions = {
        'predictedSavingsNextMonth': round(pred_savings[0], 2),
        'predictedExpensesNextMonth': round(pred_expenses[0], 2),
        'savingsTrend': sav_trend,
        'savingsTrendPercent': sav_pct,
        'expenseTrend': exp_trend,
        'expenseTrendPercent': exp_pct,
        'incomeTrend': inc_trend,
        'incomeTrendPercent': inc_pct,
    }

    recommendations = generate_recommendations(data, predictions, health_result)

    return jsonify({
        'predictions': predictions,
        'financialHealth': health_result,
        'recommendations': recommendations,
        'dataPoints': len(data),
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
