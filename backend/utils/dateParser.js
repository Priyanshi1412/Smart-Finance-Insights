const MONTH_NAMES = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

function formatMonthStr(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getMonthRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseDateExpression(query) {
  const q = query.toLowerCase().trim();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // "today"
  if (/\btoday\b/.test(q)) {
    const start = new Date(currentYear, currentMonth, currentDay, 0, 0, 0);
    const end = new Date(currentYear, currentMonth, currentDay, 23, 59, 59, 999);
    return {
      type: 'single_day',
      start,
      end,
      label: 'today',
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "yesterday"
  if (/\byesterday\b/.test(q)) {
    const yesterday = new Date(currentYear, currentMonth, currentDay - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return {
      type: 'single_day',
      start,
      end,
      label: 'yesterday',
      monthStr: formatMonthStr(yesterday.getFullYear(), yesterday.getMonth()),
    };
  }

  // "this week"
  if (/\bthis\s+week\b/.test(q)) {
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(currentYear, currentMonth, currentDay - dayOfWeek);
    const endOfWeek = new Date(currentYear, currentMonth, currentDay - dayOfWeek + 6, 23, 59, 59, 999);
    return {
      type: 'range',
      start: startOfWeek,
      end: endOfWeek,
      label: 'this week',
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "last week"
  if (/\blast\s+week\b/.test(q)) {
    const dayOfWeek = now.getDay();
    const startOfLastWeek = new Date(currentYear, currentMonth, currentDay - dayOfWeek - 7);
    const endOfLastWeek = new Date(currentYear, currentMonth, currentDay - dayOfWeek - 1, 23, 59, 59, 999);
    return {
      type: 'range',
      start: startOfLastWeek,
      end: endOfLastWeek,
      label: 'last week',
      monthStr: formatMonthStr(startOfLastWeek.getFullYear(), startOfLastWeek.getMonth()),
    };
  }

  // "last N months" or "past N months"
  const lastNMonths = q.match(/\b(?:last|past|previous)\s+(\d+)\s+months?\b/);
  if (lastNMonths) {
    const n = parseInt(lastNMonths[1], 10);
    const startMonth = new Date(currentYear, currentMonth - (n - 1), 1);
    const endMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    const months = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(currentYear, currentMonth - (n - 1) + i);
      months.push(formatMonthStr(d.getFullYear(), d.getMonth()));
    }
    return {
      type: 'multi_month',
      start: startMonth,
      end: endMonth,
      label: `last ${n} months`,
      months,
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "this month"
  if (/\bthis\s+month\b/.test(q) || /\bcurrent\s+month\b/.test(q)) {
    return {
      type: 'single_month',
      ...getMonthRange(formatMonthStr(currentYear, currentMonth)),
      label: 'this month',
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "last month" / "previous month"
  if (/\blast\s+month\b/.test(q) || /\bprevious\s+month\b/.test(q)) {
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthStr = formatMonthStr(prevDate.getFullYear(), prevDate.getMonth());
    return {
      type: 'single_month',
      ...getMonthRange(prevMonthStr),
      label: 'last month',
      monthStr: prevMonthStr,
    };
  }

  // "this year"
  if (/\bthis\s+year\b/.test(q) || /\bcurrent\s+year\b/.test(q)) {
    return {
      type: 'range',
      start: new Date(currentYear, 0, 1),
      end: new Date(currentYear, 11, 31, 23, 59, 59, 999),
      label: 'this year',
      months: Array.from({ length: 12 }, (_, i) => formatMonthStr(currentYear, i)),
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "last year"
  if (/\blast\s+year\b/.test(q)) {
    const prevYear = currentYear - 1;
    return {
      type: 'range',
      start: new Date(prevYear, 0, 1),
      end: new Date(prevYear, 11, 31, 23, 59, 59, 999),
      label: 'last year',
      months: Array.from({ length: 12 }, (_, i) => formatMonthStr(prevYear, i)),
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "this quarter"
  if (/\bthis\s+quarter\b/.test(q) || /\bcurrent\s+quarter\b/.test(q)) {
    const quarterStart = Math.floor(currentMonth / 3) * 3;
    const months = [];
    for (let i = quarterStart; i < quarterStart + 3; i++) {
      months.push(formatMonthStr(currentYear, i));
    }
    return {
      type: 'range',
      start: new Date(currentYear, quarterStart, 1),
      end: new Date(currentYear, quarterStart + 3, 0, 23, 59, 59, 999),
      label: 'this quarter',
      months,
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "last quarter"
  if (/\blast\s+quarter\b/.test(q)) {
    const prevQuarterMonth = Math.floor(currentMonth / 3) * 3 - 3;
    const qYear = prevQuarterMonth < 0 ? currentYear - 1 : currentYear;
    const qMonth = prevQuarterMonth < 0 ? prevQuarterMonth + 12 : prevQuarterMonth;
    const months = [];
    for (let i = qMonth; i < qMonth + 3; i++) {
      months.push(formatMonthStr(qYear, i));
    }
    return {
      type: 'range',
      start: new Date(qYear, qMonth, 1),
      end: new Date(qYear, qMonth + 3, 0, 23, 59, 59, 999),
      label: 'last quarter',
      months,
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // "in <month name>" or "<month name>" (e.g., "in July", "expenses of June", "for January 2025")
  const monthMatch = q.match(/\b(?:in|for|of|during)\s+(\w{3,9})\s*(?:(\d{4}))?\b/) ||
                     q.match(/\b(\w{3,9})\s+(\d{4})\b/) ||
                     q.match(/\b(?:in|for|of)\s+(\w{3,9})\b/);
  if (monthMatch) {
    const monthName = monthMatch[1];
    const monthNum = MONTH_NAMES[monthName];
    if (monthNum !== undefined) {
      const year = monthMatch[2] ? parseInt(monthMatch[2], 10) : currentYear;
      const monthStr = formatMonthStr(year, monthNum);
      return {
        type: 'single_month',
        ...getMonthRange(monthStr),
        label: `${monthName} ${year}`,
        monthStr,
      };
    }
  }

  // "N days ago" or "N weeks ago"
  const daysAgo = q.match(/(\d+)\s+days?\s+ago/);
  if (daysAgo) {
    const n = parseInt(daysAgo[1], 10);
    const target = new Date(currentYear, currentMonth, currentDay - n);
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
    return {
      type: 'single_day',
      start,
      end,
      label: `${n} days ago`,
      monthStr: formatMonthStr(target.getFullYear(), target.getMonth()),
    };
  }

  // "recent" / "recently" / "lately" -> last 30 days
  if (/\b(recent|recently|lately|last\s+few\s+days)\b/.test(q)) {
    const start = new Date(currentYear, currentMonth, currentDay - 30);
    return {
      type: 'range',
      start,
      end: now,
      label: 'last 30 days',
      monthStr: formatMonthStr(currentYear, currentMonth),
    };
  }

  // Default: current month
  return {
    type: 'single_month',
    ...getMonthRange(formatMonthStr(currentYear, currentMonth)),
    label: 'this month',
    monthStr: formatMonthStr(currentYear, currentMonth),
  };
}

function getMonthStrFromDate(date) {
  return formatMonthStr(date.getFullYear(), date.getMonth());
}

module.exports = { parseDateExpression, getMonthRange, getMonthStrFromDate, formatMonthStr, MONTH_NAMES };
