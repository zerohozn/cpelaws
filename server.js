const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();

// Ensure database file is created directly in project directory
const dbPath = path.join(__dirname, 'karinderia.db');
const db = new Database(dbPath);

// Enable WAL mode to prevent file-locking issues
db.pragma('journal_mode = WAL');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/* ==========================================================================
   1. DATABASE SCHEMA INITIALIZATION & SEED DATA
   ========================================================================== */
db.exec(`
    CREATE TABLE IF NOT EXISTS auth_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        user_name TEXT NOT NULL,
        login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        badge TEXT DEFAULT '',
        image TEXT DEFAULT '',
        target_day TEXT DEFAULT 'today'
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

    CREATE TABLE IF NOT EXISTS queue_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        service_type TEXT NOT NULL,
        status TEXT DEFAULT 'Waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dining_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity TEXT NOT NULL,
        is_reserved INTEGER DEFAULT 0,
        reserved_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        contact_no TEXT NOT NULL,
        party_size INTEGER NOT NULL,
        res_date TEXT NOT NULL,
        res_time TEXT NOT NULL,
        status TEXT DEFAULT 'Confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES dining_tables(id)
    );
`);

// Seed default menu items & tables if empty
const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get().count;
if (menuCount === 0) {
    const insertMenu = db.prepare('INSERT INTO menu_items (name, price, category, badge, image, target_day) VALUES (?, ?, ?, ?, ?, ?)');
    insertMenu.run("Pork Adobo", 70.0, "Ulam", "Best Seller", "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=400&auto=format&fit=crop", "today");
    insertMenu.run("Sinigang na Baboy", 80.0, "Ulam", "Hot", "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&auto=format&fit=crop", "today");
    insertMenu.run("Pinakbet", 50.0, "Ulam", "Healthy", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop", "today");
    insertMenu.run("Extra Rice", 15.0, "Kanin", "", "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&auto=format&fit=crop", "today");
    insertMenu.run("Sago't Gulaman", 20.0, "Inumin", "Cold", "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop", "today");
    insertMenu.run("Banana Cue", 25.0, "Meryenda", "Snack", "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400&auto=format&fit=crop", "today");

    insertMenu.run("Bicol Express", 75.0, "Ulam", "Spicy", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&auto=format&fit=crop", "tomorrow");
    insertMenu.run("Chicken Curry", 80.0, "Ulam", "Special", "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&auto=format&fit=crop", "tomorrow");
    insertMenu.run("Extra Rice", 15.0, "Kanin", "", "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&auto=format&fit=crop", "tomorrow");
    insertMenu.run("Iced Tea", 20.0, "Inumin", "", "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop", "tomorrow");
}

const tableCount = db.prepare('SELECT COUNT(*) as count FROM dining_tables').get().count;
if (tableCount === 0) {
    const insertTable = db.prepare('INSERT INTO dining_tables (name, capacity, is_reserved, reserved_by) VALUES (?, ?, ?, ?)');
    insertTable.run("Table 1", "2 Seats", 0, "");
    insertTable.run("Table 2", "4 Seats", 1, "Jose Rizal");
    insertTable.run("Table 3", "2 Seats", 0, "");
    insertTable.run("Table 4", "6 Seats", 0, "");
    insertTable.run("Table 5", "4 Seats", 1, "Maria Clara");
    insertTable.run("Table 6", "2 Seats", 0, "");
    insertTable.run("Table 7", "8 Seats", 0, "");
    insertTable.run("Table 8", "4 Seats", 0, "");
}

/* ==========================================================================
   2. ROUTE DEFINITIONS
   ========================================================================== */

// ROOT ROUTE
app.get('/', (req, res) => {
    res.send('Welcome to Boss SanAg\'s Karinderia API Service!');
    res.send('http://localhost:3000 (main database)');
    res.send('http://localhost:3000/api/orders/today (orders today)');
    res.send('http://localhost:3000/api/orders (orders all)');
    res.send('http://localhost:3000/api/logs/auth (staff logins)');
});
});

// --- AUTH LOGS ---
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

app.get('/api/logs/auth', (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM auth_logs ORDER BY login_timestamp DESC').all();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MENU ITEMS ---
app.get('/api/menu', (req, res) => {
    try {
        const { target_day } = req.query;
        let query = 'SELECT * FROM menu_items';
        const params = [];
        if (target_day) {
            query += ' WHERE target_day = ?';
            params.push(target_day);
        }
        const items = db.prepare(query).all(...params);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/menu', (req, res) => {
    const { name, price, category, badge, image, targetDay } = req.body;
    if (!name || price === undefined || !category) {
        return res.status(400).json({ error: 'Name, price, and category are required.' });
    }
    try {
        const stmt = db.prepare('INSERT INTO menu_items (name, price, category, badge, image, target_day) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(name, price, category, badge || 'New', image || '', targetDay || 'today');
        res.status(201).json({ success: true, itemId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ORDERS ---
// Get All Orders
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

// NEW API: Get Today's Orders Only
app.get('/api/orders/today', (req, res) => {
    try {
        // Query orders created on today's local date
        const orders = db.prepare(`
            SELECT * FROM orders 
            WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
            ORDER BY created_at DESC
        `).all();

        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

        const fullOrders = orders.map(order => ({
            ...order,
            items: getItems.all(order.id)
        }));

        res.json({
            count: fullOrders.length,
            totalSalesToday: fullOrders.reduce((sum, o) => sum + o.subtotal, 0),
            orders: fullOrders
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Order
app.post('/api/orders', (req, res) => {
    const { customerName, orderType, subtotal, items } = req.body;
    if (!orderType || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Invalid order payload.' });
    }

    const insertOrder = db.prepare('INSERT INTO orders (customer_name, order_type, subtotal) VALUES (?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO order_items (order_id, item_name, unit_price, quantity, total_price) VALUES (?, ?, ?, ?, ?)');

    const transaction = db.transaction((orderData, itemData) => {
        const result = insertOrder.run(orderData.customerName || 'Walk-in Guest', orderData.orderType, orderData.subtotal);
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

// --- QUEUE MANAGEMENT ---
app.get('/api/queue', (req, res) => {
    try {
        const tickets = db.prepare('SELECT * FROM queue_tickets WHERE status != "Completed" ORDER BY id ASC').all();
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/queue/ticket', (req, res) => {
    const { name, serviceType } = req.body;
    if (!name || !serviceType) {
        return res.status(400).json({ error: 'Customer name and service type are required.' });
    }
    try {
        const lastTicket = db.prepare('SELECT MAX(number) as maxNum FROM queue_tickets').get();
        const nextNumber = (lastTicket.maxNum || 0) + 1;

        const stmt = db.prepare('INSERT INTO queue_tickets (number, customer_name, service_type, status) VALUES (?, ?, ?, ?)');
        const result = stmt.run(nextNumber, name, serviceType, 'Waiting');

        res.status(201).json({ success: true, ticketNumber: nextNumber, ticketId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/queue/call-next', (req, res) => {
    try {
        db.prepare('UPDATE queue_tickets SET status = "Completed" WHERE status = "Serving"').run();

        const nextTicket = db.prepare('SELECT * FROM queue_tickets WHERE status = "Waiting" ORDER BY id ASC LIMIT 1').get();

        if (nextTicket) {
            db.prepare('UPDATE queue_tickets SET status = "Serving" WHERE id = ?').run(nextTicket.id);
            res.json({ success: true, servingTicket: nextTicket });
        } else {
            res.json({ success: true, message: 'No customers waiting in line.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TABLES & RESERVATIONS ---
app.get('/api/tables', (req, res) => {
    try {
        const tables = db.prepare('SELECT * FROM dining_tables').all();
        res.json(tables);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reservations', (req, res) => {
    try {
        const reservations = db.prepare('SELECT * FROM reservations ORDER BY created_at DESC').all();
        res.json(reservations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reservations', (req, res) => {
    const { tableId, tableName, customerName, contactNo, partySize, date, time } = req.body;
    if (!tableId || !customerName || !contactNo) {
        return res.status(400).json({ error: 'Missing required reservation parameters.' });
    }

    const updateTable = db.prepare('UPDATE dining_tables SET is_reserved = 1, reserved_by = ? WHERE id = ?');
    const insertRes = db.prepare('INSERT INTO reservations (table_id, table_name, customer_name, contact_no, party_size, res_date, res_time) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const transaction = db.transaction(() => {
        updateTable.run(customerName, tableId);
        const result = insertRes.run(tableId, tableName, customerName, contactNo, partySize, date, time);
        return result.lastInsertRowid;
    });

    try {
        const resId = transaction();
        res.status(201).json({ success: true, reservationId: resId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN / ADVANCE DAY ---
app.post('/api/admin/advance-day', (req, res) => {
    try {
        const advanceTransaction = db.transaction(() => {
            db.prepare('DELETE FROM menu_items WHERE target_day = "today"').run();
            db.prepare('UPDATE menu_items SET target_day = "today" WHERE target_day = "tomorrow"').run();
            db.prepare('DELETE FROM queue_tickets').run();
        });

        advanceTransaction();
        res.json({ success: true, message: "Day advanced! Tomorrow's menu is now Today's menu." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CATCH-ALL 404 HANDLER
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});


// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Karinderia API running on http://localhost:${PORT}`);
});
