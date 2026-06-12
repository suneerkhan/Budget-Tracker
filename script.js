let transactions = JSON.parse(localStorage.getItem('bt_transactions') || '[]');
let currency = localStorage.getItem('bt_currency') || '₹';
let activeFilter = 'all';
let chart = null;

function fmt(n) {
  return currency + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function save() {
  localStorage.setItem('bt_transactions', JSON.stringify(transactions));
  localStorage.setItem('bt_currency', currency);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, isExpense) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  m.textContent = msg;
  t.style.background = isExpense ? '#D85A30' : '#1D9E75';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function setCurrency(cur, btn) {
  currency = cur;
  document.querySelectorAll('.cur-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  save();
  render();
  renderChart();
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function getFilteredTransactions() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const now = new Date();

  return transactions.filter(t => {
    const matchSearch = !query || t.desc.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
    if (!matchSearch) return false;

    if (activeFilter === 'week') {
      const d = new Date(t.timestamp);
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (activeFilter === 'month') {
      const d = new Date(t.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });
}

function render() {
  const filtered = getFilteredTransactions();
  const income = filtered.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;

  const balEl = document.getElementById('balance');
  balEl.textContent = (balance < 0 ? '-' : '') + fmt(balance);
  balEl.className = 'balance-amount' + (balance < 0 ? ' negative' : '');
  document.getElementById('total-income').textContent = fmt(income);
  document.getElementById('total-expense').textContent = fmt(expense);

  const list = document.getElementById('tx-list');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">💳</span>${transactions.length === 0 ? 'No transactions yet. Add one above!' : 'No transactions match your filter.'}</div>`;
    return;
  }

  list.innerHTML = [...filtered].reverse().map(t => `
    <div class="tx-item">
      <div class="tx-icon ${t.type}">${t.type === 'income' ? '↓' : '↑'}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(t.desc)}</div>
        <div class="tx-meta">
          <span class="tx-date">${t.date}</span>
          <span class="tx-cat">${escapeHtml(t.category)}</span>
        </div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
      <div class="tx-actions">
        <button class="tx-edit" onclick="openEdit('${t.id}')" title="Edit">✎</button>
        <button class="tx-del" onclick="deleteTransaction('${t.id}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function renderChart() {
  const now = new Date();
  const months = [];
  const incomeData = [];
  const expenseData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short' });
    months.push(label);
    const m = d.getMonth(), y = d.getFullYear();
    const monthTx = transactions.filter(t => {
      const td = new Date(t.timestamp);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    incomeData.push(parseFloat(monthTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0).toFixed(2)));
    expenseData.push(parseFloat(monthTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0).toFixed(2)));
  }

  document.getElementById('chart-month-label').textContent =
    now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const ctx = document.getElementById('monthChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(29,158,117,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: 'rgba(216,90,48,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'rgba(255,255,255,0.55)', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${currency}${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.4)', callback: v => currency + v }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function addTransaction(type) {
  const descEl = document.getElementById(`${type}-desc`);
  const amountEl = document.getElementById(`${type}-amount`);
  const catEl = document.getElementById(`${type}-category`);

  const desc = descEl.value.trim();
  const amount = parseFloat(amountEl.value);
  const category = catEl.value;

  if (!desc || isNaN(amount) || amount <= 0) {
    amountEl.style.borderColor = 'rgba(216,90,48,0.6)';
    setTimeout(() => { amountEl.style.borderColor = ''; }, 1200);
    return;
  }

  const now = new Date();
  transactions.push({
    id: Date.now().toString(),
    type, desc, amount, category,
    timestamp: now.getTime(),
    date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  });

  descEl.value = '';
  amountEl.value = '';
  save();
  render();
  renderChart();
  showToast(`${type === 'income' ? 'Income' : 'Expense'} added!`, type === 'expense');
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  renderChart();
}

function clearAll() {
  if (transactions.length === 0) return;
  if (confirm('Clear all transactions? This cannot be undone.')) {
    transactions = [];
    save();
    render();
    renderChart();
  }
}

function openEdit(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;
  document.getElementById('edit-desc').value = t.desc;
  document.getElementById('edit-amount').value = t.amount;
  document.getElementById('edit-id').value = t.id;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const desc = document.getElementById('edit-desc').value.trim();
  const amount = parseFloat(document.getElementById('edit-amount').value);
  if (!desc || isNaN(amount) || amount <= 0) return;

  const t = transactions.find(t => t.id === id);
  if (t) { t.desc = desc; t.amount = amount; }
  save();
  closeModal();
  render();
  renderChart();
  showToast('Transaction updated!', false);
}

render();
renderChart();