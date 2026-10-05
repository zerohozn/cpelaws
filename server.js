const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();

const dbPath = path.join(__dirname, 'karinderia.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper function to format array of objects into CSV string
function convertToCSV(array) {
  if (!array || array.length === 0) return '';
  const headers = Object.keys(array[0]).join(',');
  const rows = array.map(row => 
    Object.values(row)
      .map(val => `"${String(val).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers, ...rows].join('\n');
}

// API: Export Orders to CSV (Excel format)
app.get('/api/export/orders/csv', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        o.id AS order_id,
        o.customer_name,
        o.order_type,
        oi.item_name,
        oi.unit_price,
        oi.quantity,
        oi.total_price,
        o.subtotal AS order_subtotal,
        o.created_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      ORDER BY o.created_at DESC
    `).all();

    const csv = convertToCSV(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="karinderia_orders.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Export Auth Logs to CSV (Excel format)
app.get('/api/export/logs/csv', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM auth_logs ORDER BY login_timestamp DESC').all();
    const csv = convertToCSV(logs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="auth_logs.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Karinderia API running on http://localhost:${PORT}`);
});
