require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// -----------------------------------------------------------------------------
// APP & SUPABASE INITIALIZATION
// -----------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// -----------------------------------------------------------------------------
// 1. ROUTE DEFINITIONS
// -----------------------------------------------------------------------------

// Root Endpoint
app.get('/', (req, res) => {
  res.send("Welcome to Boss SanAg's Karinderia API Service!");
});

// --- AUTH LOGS ---
app.post('/api/logs/auth', async (req, res) => {
  const { role, userName } = req.body;
  if (!role || !userName) {
    return res.status(400).json({ error: 'Role and userName are required.' });
  }

  const { data, error } = await supabase
    .from('auth_logs')
    .insert([{ role, user_name: userName }])
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, logId: data.id });
});

app.get('/api/logs/auth', async (req, res) => {
  const { data, error } = await supabase
    .from('auth_logs')
    .select('*')
    .order('login_timestamp', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- MENU ITEMS ---
app.get('/api/menu', async (req, res) => {
  const { target_day } = req.query;
  let query = supabase.from('menu_items').select('*');

  if (target_day) {
    query = query.eq('target_day', target_day);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/menu', async (req, res) => {
  const { name, price, category, badge, image, targetDay } = req.body;
  if (!name || price === undefined || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required.' });
  }

  const { data, error } = await supabase
    .from('menu_items')
    .insert([{
      name,
      price,
      category,
      badge: badge || 'New',
      image: image || '',
      target_day: targetDay || 'today'
    }])
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, itemId: data.id });
});

// --- ORDERS ---
app.get('/api/orders', async (req, res) => {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .order('created_at', { ascending: false });

  if (ordersError) return res.status(500).json({ error: ordersError.message });
  res.json(orders);
});

app.get('/api/orders/today', async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const totalSalesToday = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);

  res.json({
    count: orders.length,
    totalSalesToday,
    orders
  });
});

app.post('/api/orders', async (req, res) => {
  const { customerName, orderType, subtotal, items } = req.body;
  if (!orderType || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order payload.' });
  }

  // Insert Order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      customer_name: customerName || 'Walk-in Guest',
      order_type: orderType,
      subtotal
    }])
    .select('id')
    .single();

  if (orderError) return res.status(500).json({ error: orderError.message });

  // Map and Insert Order Items
  const orderItemsPayload = items.map(item => ({
    order_id: order.id,
    item_name: item.name,
    unit_price: item.price,
    quantity: item.qty,
    total_price: item.price * item.qty
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload);

  if (itemsError) return res.status(500).json({ error: itemsError.message });

  res.status(201).json({ success: true, orderId: order.id });
});

// --- QUEUE MANAGEMENT ---
app.get('/api/queue', async (req, res) => {
  const { data, error } = await supabase
    .from('queue_tickets')
    .select('*')
    .neq('status', 'Completed')
    .order('id', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/queue/ticket', async (req, res) => {
  const { name, serviceType } = req.body;
  if (!name || !serviceType) {
    return res.status(400).json({ error: 'Customer name and service type are required.' });
  }

  // Get current max ticket number
  const { data: maxTicket } = await supabase
    .from('queue_tickets')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (maxTicket?.number || 0) + 1;

  const { data, error } = await supabase
    .from('queue_tickets')
    .insert([{
      number: nextNumber,
      customer_name: name,
      service_type: serviceType,
      status: 'Waiting'
    }])
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, ticketNumber: nextNumber, ticketId: data.id });
});

app.post('/api/queue/call-next', async (req, res) => {
  // Mark currently serving tickets as completed
  const { error: updateError } = await supabase
    .from('queue_tickets')
    .update({ status: 'Completed' })
    .eq('status', 'Serving');

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Get next ticket in line
  const { data: nextTicket } = await supabase
    .from('queue_tickets')
    .select('*')
    .eq('status', 'Waiting')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextTicket) {
    await supabase
      .from('queue_tickets')
      .update({ status: 'Serving' })
      .eq('id', nextTicket.id);

    res.json({ success: true, servingTicket: { ...nextTicket, status: 'Serving' } });
  } else {
    res.json({ success: true, message: 'No customers waiting in line.' });
  }
});

// --- TABLES & RESERVATIONS ---
app.get('/api/tables', async (req, res) => {
  const { data, error } = await supabase.from('dining_tables').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/reservations', async (req, res) => {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/reservations', async (req, res) => {
  const { tableId, tableName, customerName, contactNo, partySize, date, time } = req.body;
  if (!tableId || !customerName || !contactNo) {
    return res.status(400).json({ error: 'Missing required reservation parameters.' });
  }

  // Update dining table
  const { error: tableError } = await supabase
    .from('dining_tables')
    .update({ is_reserved: true, reserved_by: customerName })
    .eq('id', tableId);

  if (tableError) return res.status(500).json({ error: tableError.message });

  // Insert reservation record
  const { data, error: resError } = await supabase
    .from('reservations')
    .insert([{
      table_id: tableId,
      table_name: tableName,
      customer_name: customerName,
      contact_no: contactNo,
      party_size: partySize,
      res_date: date,
      res_time: time
    }])
    .select('id')
    .single();

  if (resError) return res.status(500).json({ error: resError.message });
  res.status(201).json({ success: true, reservationId: data.id });
});

// --- ADMIN / ADVANCE DAY ---
app.post('/api/admin/advance-day', async (req, res) => {
  // Delete today's menu items
  const { error: deleteError } = await supabase
    .from('menu_items')
    .delete()
    .eq('target_day', 'today');

  if (deleteError) return res.status(500).json({ error: deleteError.message });

  // Shift tomorrow's menu items to today
  const { error: updateError } = await supabase
    .from('menu_items')
    .update({ target_day: 'today' })
    .eq('target_day', 'tomorrow');

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Clear queue tickets
  const { error: queueError } = await supabase
    .from('queue_tickets')
    .delete()
    .neq('id', 0); // Delete all rows

  if (queueError) return res.status(500).json({ error: queueError.message });

  res.json({ success: true, message: "Day advanced! Tomorrow's menu is now Today's menu." });
});

// -----------------------------------------------------------------------------
// 404 & SERVER STARTUP
// -----------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

app.listen(PORT, () => {
  console.log(`Karinderia API server active on http://localhost:${PORT}`);
});