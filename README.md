<div align="center">

# Smart Finance Insights

### Your Personal Finance Command Center

A full-stack MERN application with AI-powered financial recommendations, investment tracking, portfolio analytics, and beautiful glassmorphism UI — built to help you take control of your money.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=flat-square&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.0.0-3B82F6?style=flat-square)
![License](https://img.shields.io/badge/License-Private-FF6B6B?style=flat-square)

</div>

---

## What Makes It Special

### Core Features
- **Dashboard** — Real-time financial overview with summary cards, investment summary, portfolio growth, asset allocation, top/worst performers, goals progress, and risk analysis
- **Income Tracking** — Add, edit, delete with source categorization
- **Expense Management** — Category-wise tracking with monthly filters
- **Budget Planning** — Set limits per category, visual progress bars
- **Financial Goal Planning** — Create goals with priority/status, track contributions, analytics, achievements, and AI recommendations
- **Investment Portfolio** — Full CRUD, profit/loss tracking, type/category breakdown, diversification score
- **Asset Allocation** — Interactive doughnut charts by type and category, allocation percentages, diversification analysis, filters
- **Portfolio Analytics** — Comprehensive analytics combining investments and goals, risk scoring, performance tables
- **AI Insights** — Rule-based recommendations from your spending data
- **Reports** — Financial metrics and savings rate analysis

### Design Features
- **Glassmorphism UI** — Modern frosted glass aesthetic
- **Dark/Light Theme** — Smooth CSS variable transitions
- **Responsive** — Adaptive grid layouts across all devices
- **Charts** — Chart.js (Bar, Doughnut, Line) + Recharts for data visualization
- **Animations** — fadeIn, slideUp, scaleIn, pulse effects
- **Progress Rings** — SVG circular progress indicators
- **Protected Routes** — JWT-based auth guards

---

## Tech Stack

```
FRONTEND
  React 19, React Router 6, Axios, Chart.js, Recharts
  CSS Variables, Glassmorphism, Responsive Grid

BACKEND
  Node.js, Express 4, MongoDB (Mongoose), JWT, bcrypt
  RESTful API, Auth Middleware, CRUD Operations

ML SERVICE
  Python 3.9+, Flask, Scikit-learn, NumPy, Pandas
  Linear Regression, Financial Predictions
```

---

## Project Structure

```
Smart Finance Insights/
│
├── backend/
│   ├── index.js              # Express server + all models/routes
│   ├── package.json
│   └── .env                  # Environment variables
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js          # Entry point (BrowserRouter + Providers)
│   │   ├── index.css         # Global CSS variables + animations
│   │   ├── App.js            # Route definitions + auth guards
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.js    # Login, register, logout state
│   │   │   └── ThemeContext.js   # Dark/light theme toggle
│   │   │
│   │   ├── services/
│   │   │   └── api.js           # Axios interceptors + API methods
│   │   │
│   │   ├── components/
│   │   │   ├── Layout.js        # Sidebar + topbar (responsive)
│   │   │   ├── Icon.js          # 57+ SVG icon paths
│   │   │   └── ui/
│   │   │       ├── Button.js         # 5 variants + loading
│   │   │       ├── Card.js           # Glassmorphism + hover glow
│   │   │       ├── Input.js          # Focus glow + error states
│   │   │       ├── Select.js         # Styled dropdown
│   │   │       ├── Badge.js          # 6 color variants
│   │   │       ├── ProgressRing.js   # SVG circular progress
│   │   │       ├── SemiCircleGauge.js# Gauge for scores
│   │   │       ├── EmptyState.js     # Placeholder component
│   │   │       └── LoadingSpinner.js # Animated loader
│   │   │
│   │   ├── pages/
│   │   │   ├── Register.js          # / — Create account
│   │   │   ├── Login.js             # /login — Sign in
│   │   │   ├── Confirmation.js      # /confirmation — Post-login
│   │   │   ├── Dashboard.js         # /dashboard — Overview + investment widgets
│   │   │   ├── Income.js            # /income — CRUD
│   │   │   ├── Expenses.js          # /expenses — CRUD
│   │   │   ├── Budget.js            # /budget — Limits
│   │   │   ├── Reports.js           # /reports — Analytics
│   │   │   ├── FinancialGoalPlanning.js  # /financial-goal-planning — Goal CRUD + analytics + contributions
│   │   │   ├── Investments.js       # /investments — CRUD + Portfolio
│   │   │   ├── AssetAllocation.js   # /asset-allocation — Allocation breakdown
│   │   │   ├── PortfolioAnalytics.js# /portfolio-analytics — Full analytics
│   │   │   ├── AIInsights.js        # /ai-insights — Recommendations
│   │   │   ├── Profile.js           # /profile — Account info
│   │   │   └── Settings.js          # /settings — Theme + danger zone
│   │   │
│   │   └── utils/
│   │       └── financialHealth.js # Score calculator
│   │
│   └── package.json
│
├── ml/
│   ├── app.py                # Flask ML service
│   ├── requirements.txt      # Python dependencies
│   └── venv/                 # Virtual environment
│
├── package.json              # Root scripts (concurrently)
└── README.md
```

---

## Quick Start

### Prerequisites

| Software | Version | Link |
|----------|---------|------|
| Node.js | >= 18.x | [Download](https://nodejs.org/) |
| MongoDB | >= 6.x | [Download](https://www.mongodb.com/try/download/community) |
| Python | >= 3.9 | [Download](https://www.python.org/downloads/) |

### 1. Clone & Install

```bash
git clone https://github.com/your-username/Smart-Finance-Insights.git
cd Smart-Finance-Insights
npm install
```

### 2. Configure Environment

```bash
# Create backend/.env
MONGODB_URI=mongodb://localhost:27017/smart_finance
JWT_SECRET=your_super_secret_random_key_here
PORT=4000
```

### 3. Start Development

```bash
# Start both backend (port 4000) and frontend (port 3000)
npm start
```

### 4. (Optional) ML Service

```bash
cd ml
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
python app.py              # Runs on port 5000
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Create account |
| `POST` | `/api/login` | Get JWT token |
| `GET` | `/api/health` | Health check |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/summary` | Income, expenses, savings, budget |
| `GET` | `/api/dashboard/recent-transactions` | Latest 5 transactions |

### Income

| Method | Endpoint | Body |
|--------|----------|------|
| `GET` | `/api/income` | — |
| `POST` | `/api/income` | `{ amount, source, date, category }` |
| `PUT` | `/api/income/:id` | Same as above |
| `DELETE` | `/api/income/:id` | — |

### Expenses

| Method | Endpoint | Body |
|--------|----------|------|
| `GET` | `/api/expenses` | — |
| `POST` | `/api/expenses` | `{ amount, category, date, description, paymentMethod }` |
| `PUT` | `/api/expenses/:id` | Same as above |
| `DELETE` | `/api/expenses/:id` | — |

### Budget

| Method | Endpoint | Body |
|--------|----------|------|
| `GET` | `/api/budget` | — |
| `POST` | `/api/budget` | `{ category, limit, month }` |

### Goals

| Method | Endpoint | Body |
|--------|----------|------|
| `GET` | `/api/goals` | — |
| `POST` | `/api/goals` | `{ goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, priority }` |
| `PUT` | `/api/goals/:id` | Same as above |
| `DELETE` | `/api/goals/:id` | — |
| `POST` | `/api/goals/:id/contributions` | `{ amount, date, note }` |
| `GET` | `/api/goals/analytics` | Returns summary, achievements, recommendations, monthly data, category distribution |

### Investments

| Method | Endpoint | Body |
|--------|----------|------|
| `GET` | `/api/investments` | — |
| `POST` | `/api/investments` | `{ name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes }` |
| `PUT` | `/api/investments/:id` | Same as above |
| `DELETE` | `/api/investments/:id` | — |
| `GET` | `/api/investments/analytics` | Returns type/category breakdown, performance, diversification score |

### Portfolio Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/portfolio/analytics` | Combined investment + goal analytics, risk score, monthly growth, top/worst performers |

### ML Service

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Service health |
| `POST` | `/predict` | `{ amount }` | Predict future value |

### Data Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `DELETE` | `/api/clear-data` | Clear all user data (income, expenses, budgets, goals, investments) |

---

## Frontend Routes

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/` | Register | Public | Create a new account |
| `/login` | Login | Public | Sign in |
| `/confirmation` | Confirmation | Protected | Post-login confirmation |
| `/dashboard` | Dashboard | Protected | Financial overview + investment widgets |
| `/income` | Income | Protected | Income CRUD |
| `/expenses` | Expenses | Protected | Expense CRUD |
| `/budget` | Budget | Protected | Budget limits |
| `/reports` | Reports | Protected | Financial analytics |
| `/financial-goal-planning` | Financial Goal Planning | Protected | Goal CRUD, contributions, analytics, achievements |
| `/investments` | Investments | Protected | Portfolio management + CRUD |
| `/asset-allocation` | Asset Allocation | Protected | Allocation breakdown by type/category |
| `/portfolio-analytics` | Portfolio Analytics | Protected | Comprehensive investment + goal analytics |
| `/ai-insights` | AI Insights | Protected | Recommendations |
| `/profile` | Profile | Protected | Account details |
| `/settings` | Settings | Protected | Theme + preferences |

---

## Data Models

```javascript
// User
{
  name:        String (required),
  email:       String (required, unique),
  password:    String (hashed, required),
  createdAt:   Date
}

// Income
{
  userId:      ObjectId (ref: User, required),
  amount:      Number (required),
  source:      String (required),
  category:    String,
  date:        Date,
  description: String
}

// Expense
{
  userId:        ObjectId (ref: User, required),
  amount:        Number (required),
  category:      String (required),
  date:          Date,
  description:   String,
  paymentMethod: String
}

// Goal
{
  userId:        ObjectId (ref: User, required),
  goalName:      String (required),
  category:      String (required),
  targetAmount:  Number (required),
  savedAmount:   Number,
  monthlySaving: Number,
  targetDate:    Date (required),
  priority:      String (enum: high/medium/low, default: medium),
  status:        String (enum: active/achieved/paused/overdue, default: active),
  contributions: [{ amount: Number, date: Date, note: String }],
  createdAt:     Date,
  updatedAt:     Date
}

// Investment
{
  userId:          ObjectId (ref: User, required),
  name:            String (required),
  type:            String (required),
  category:        String (required),
  amount:          Number (required),
  currentValue:    Number (defaults to amount),
  investedDate:    Date,
  expectedReturns: Number,
  status:          String (active/closed/paused),
  notes:           String,
  createdAt:       Date,
  updatedAt:       Date
}
```

---

## Design System

### Color Palette

| Token | Usage | Dark | Light |
|-------|-------|------|-------|
| `--accent` | Primary actions | `#3B82F6` | `#2563EB` |
| `--success` | Income, positive | `#10B981` | `#059669` |
| `--warning` | Alerts, budget | `#F59E0B` | `#D97706` |
| `--danger` | Expenses, errors | `#EF4444` | `#DC2626` |
| `--purple` | Goals, special | `#8B5CF6` | `#7C3AED` |
| `--teal` | Investments | `#14B8A6` | `#0D9488` |

### Component Library

```
Button       → 5 variants (primary, secondary, danger, success, ghost)
Card         → Glassmorphism with hover glow effect
Input        → Focus glow, error states, number/date/text types
Select       → Styled dropdown with options
Badge        → 6 colors (success, danger, warning, info, purple, teal)
ProgressRing → SVG circular progress with customizable color/size
EmptyState   → Icon + message + action button
LoadingSpinner → Animated pulse spinner
SemiCircleGauge → Gauge for health scores
```

### Animations

```css
fadeIn      → 0.4s ease-out   /* Card entry */
slideUp     → 0.3s ease-out   /* Content load */
scaleIn     → 0.25s ease-out  /* Modal pop */
pulse       → 2s infinite     /* Loading states */
spin        → 1s linear       /* Spinner */
shimmer     → 2s infinite     /* Skeleton loading */
```

---

## Investment Categories

| Type | Color | Examples |
|------|-------|----------|
| Stocks | `#3B82F6` | Equities, Individual stocks |
| Mutual Funds | `#10B981` | SIP, Lumpsum |
| Fixed Deposit | `#F59E0B` | Bank FD, Corporate FD |
| PPF | `#8B5CF6` | Public Provident Fund |
| NPS | `#EC4899` | National Pension System |
| Crypto | `#F97316` | Bitcoin, Ethereum |
| Gold | `#EAB308` | Physical, Digital, ETF |
| Real Estate | `#EF4444` | Property, REITs |
| Bonds | `#06B6D4` | Government, Corporate |
| ETF | `#14B8A6` | Index ETFs |

---

## Development Commands

```bash
# Start everything (backend + frontend)
npm start

# Start only backend
npm run start-backend

# Start only frontend
npm run start-frontend

# Build for production
cd frontend && npm run build

# Run tests
cd frontend && npm test
```

---

## Responsive Breakpoints

| Device | Layout | Cards per Row |
|--------|--------|---------------|
| Desktop | >= 1024px | 3 |
| Tablet | 768px - 1023px | 2 |
| Mobile | < 768px | 1 |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is **private** and not publicly licensed.
