const express = require('express');

const Database = require('better-sqlite3');

const cors = require('cors');

const path = require('path');



const app = express();



// Ensure database file is created directly in project directory

const dbPath = path.join(__dirname, 'karinderia.db');

const db = new Database(dbPath);



// Enable WAL mode to prevent file-locking issues when inspecting

db.pragma('journal_mode = WAL');



app.use(cors());

app.use(express.json({ limit: '10mb' }));



// Initialize Schema

db.exec(`

    CREATE TABLE IF NOT EXISTS auth_logs (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        role TEXT NOT NULL,

        user_name TEXT NOT NULL,

        login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP

    );



    CREATE TABLE IF NOT EXISTS orders (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        customer_name TEXT NOT NULL,

        order_type TEXT NOT NULL,

        subtotal REAL NOT NULL,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP

    );



    CREATE TABLE IF NOT EXISTS order_items (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        order_id INTEGER NOT NULL,

        item_name TEXT NOT NULL,

        unit_price REAL NOT NULL,

        quantity INTEGER NOT NULL,

        total_price REAL NOT NULL,

        FOREIGN KEY (order_id) REFERENCES orders(id)

    );

`);



// API: Log Auth

app.post('/api/logs/auth', (req, res) => {

    const { role, userName } = req.body;

    if (!role || !userName) {

        return res.status(400).json({ error: 'Role and userName are required.' });

    }

    try {

        const stmt = db.prepare('INSERT INTO auth_logs (role, user_name) VALUES (?, ?)');

        const result = stmt.run(role, userName);

        res.status(201).json({ success: true, logId: result.lastInsertRowid });

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

});



// API: Record Order

app.post('/api/orders', (req, res) => {

    const { customerName, orderType, subtotal, items } = req.body;

    if (!orderType || !Array.isArray(items) || items.length === 0) {

        return res.status(400).json({ error: 'Invalid order payload.' });

    }



    const insertOrder = db.prepare('INSERT INTO orders (customer_name, order_type, subtotal) VALUES (?, ?, ?)');

    const insertItem = db.prepare('INSERT INTO order_items (order_id, item_name, unit_price, quantity, total_price) VALUES (?, ?, ?, ?, ?)');



    const transaction = db.transaction((orderData, itemData) => {

        const result = insertOrder.run(orderData.customerName, orderData.orderType, orderData.subtotal);

        const orderId = result.lastInsertRowid;



        for (const item of itemData) {

            insertItem.run(orderId, item.name, item.price, item.qty, item.price * item.qty);

        }

        return orderId;

    });



    try {

        const orderId = transaction({ customerName, orderType, subtotal }, items);

        res.status(201).json({ success: true, orderId });

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

});



// API: View All Auth Logs

app.get('/api/logs/auth', (req, res) => {

    try {

        const logs = db.prepare('SELECT * FROM auth_logs ORDER BY login_timestamp DESC').all();

        res.json(logs);

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

});



// API: View All Orders with Items

app.get('/api/orders', (req, res) => {

    try {

        const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');



        const fullOrders = orders.map(order => ({

            ...order,

            items: getItems.all(order.id)

        }));



        res.json(fullOrders);

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

});



// Start Server (Must be at the very bottom)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Karinderia API running on http://localhost:${PORT}`);

});
