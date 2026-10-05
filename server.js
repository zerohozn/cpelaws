// API: Export Orders as Excel-compatible CSV
app.get('/api/export/orders.csv', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT 
                o.id AS 'Order ID',
                o.customer_name AS 'Customer Name',
                o.order_type AS 'Order Type',
                i.item_name AS 'Item Name',
                i.unit_price AS 'Unit Price (PHP)',
                i.quantity AS 'Quantity',
                i.total_price AS 'Total Price (PHP)',
                o.created_at AS 'Date & Time'
            FROM orders o
            JOIN order_items i ON o.id = i.order_id
            ORDER BY o.created_at DESC
        `).all();

        if (rows.length === 0) {
            return res.status(404).send("No order records found to export.");
        }

        // Generate CSV header and rows
        const headers = Object.keys(rows[0]).join(',');
        const csvLines = rows.map(row => 
            Object.values(row).map(val => `"${val}"`).join(',')
        );
        const csvData = [headers, ...csvLines].join('\n');

        // Set response headers to trigger browser download as Excel file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Karinderia_Orders.csv"');
        res.status(200).send(csvData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
