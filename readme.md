# Boss SanAg's Karinderia - Management & POS System

Boss SanAg's Karinderia Management & POS System is an all-in-one web platform built for small-scale eatery management. The system streamlines point-of-sale ordering, queue management, table reservations, daily menu rotation, and administrative user management.

---

## 🛠️ Features & Checklist Alignment

- **Landing Page & Call-to-Action:** Interactive POS menu showcase with quick navigation tabs for queue tickets, reservations, and online ordering.
- **Authentication & Roles:** Secure register, login, and logout flow with Admin and Regular Staff role-based permissions.
- **Password Security:** All user passwords are encrypted using `bcrypt` hashing before storage.
- **Complete CRUD Operations:** Full Create, Read, Update, and Delete operations on Menu Entities (`/api/menu`).
- **Validation & Deletion Safety:** Form input validation and delete confirmation prompts.
- **Database Logs & API Reporting:** Express + SQLite backend with order metrics and live queue handling.

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (Node Package Manager)

### Step 1: Clone the Repository
```bash
git clone [https://github.com/zerohozn/cpelaws.git](https://github.com/zerohozn/cpelaws.git)
cd cpelaws