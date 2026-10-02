/* ================= UPDATED AUTHENTICATION LOGIC ================= */
async function handleAuthSubmit(e) {
    e.preventDefault();
    const pin = document.getElementById('auth-pin-input').value.trim();

    let role = null;
    let userName = "";

    if (pin === "1234") {
        role = "staff";
        userName = "Staff User";
    } else if (pin === "8888" || pin.toLowerCase() === "admin") {
        role = "admin";
        userName = "Admin User";
    }

    if (role) {
        state.auth.isAuthenticated = true;
        state.auth.role = role;
        state.auth.userName = userName;

        // Record Login Entry to Database
        try {
            await fetch('http://localhost:3000/api/logs/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, userName })
            });
        } catch (err) {
            console.error('Failed to log login event to database:', err);
        }

        closeAuthModal();
        updateAuthUI();
        switchTab('admin');
        showToast(`Logged in successfully as ${role.toUpperCase()}`, "success");
    } else {
        document.getElementById('auth-error-msg').classList.remove('hidden');
    }
}

/* ================= UPDATED CHECKOUT LOGIC ================= */
async function processCheckout() {
    if (state.currentOrder.length === 0) return;

    const customerName = document.getElementById('order-customer-name').value.trim() || "Walk-in Guest";
    const subtotal = state.currentOrder.reduce((acc, i) => acc + (i.price * i.qty), 0);

    const orderPayload = {
        customerName: customerName,
        orderType: state.orderType,
        subtotal: subtotal,
        items: state.currentOrder.map(item => ({
            name: item.name,
            price: item.price,
            qty: item.qty
        }))
    };

    // Save Order to Database
    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) throw new Error('Failed to record order.');
        showToast("Order successfully saved to database!", "success");
    } catch (err) {
        console.error('Database insertion error:', err);
        showToast("Order completed locally (Server Unreachable)", "error");
    }

    // Render Receipt Modal UI
    document.getElementById('receipt-date').textContent = new Date().toLocaleString();
    document.getElementById('receipt-type').textContent = state.orderType;
    document.getElementById('receipt-customer').textContent = customerName;
    document.getElementById('receipt-total').textContent = `₱${subtotal.toFixed(2)}`;

    const receiptList = document.getElementById('receipt-items-list');
    receiptList.innerHTML = '';
    state.currentOrder.forEach(i => {
        receiptList.innerHTML += `
            <div class="flex justify-between">
                <span>${i.qty}x ${i.name}</span>
                <span class="font-bold">₱${(i.price * i.qty).toFixed(2)}</span>
            </div>
        `;
    });

    state.totalSales += subtotal;
    state.completedOrdersCount += 1;
    updateAdminStats();

    state.currentOrder = [];
    document.getElementById('order-customer-name').value = '';
    renderOrderSummary();

    document.getElementById('receipt-modal').classList.remove('hidden');
}