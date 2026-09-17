# 🏪 ShopTrack – Mobile POS, Inventory & Sales Tracker

A beautiful, **mobile-first** web app to manage your shop's sales, inventory, profits and generate detailed Excel reports — all from your phone browser. No installation needed.

## ✨ Features

- 🛒 **Point of Sale (POS)** — Tap products to add to cart, adjust quantities, complete sale in one tap
- 📦 **Auto Inventory Deduction** — Stock automatically reduces when a sale is recorded
- 🔄 **Restock / Refill** — Add stock with quick +5/+10/+25/+50/+100 buttons
- 💰 **Profit Tracking** — Tracks revenue AND net profit `(Sell Price − Cost Price) × Qty` per product
- ⚠️ **Low Stock Alerts** — Visual warnings when stock drops below your threshold
- 📊 **Sales Analytics** — Today / This Week / All Time breakdowns per product
- 📋 **Detailed Excel Export** — 6-sheet `.xlsx` report with full stock & sales data
- 🌙 **Dark / Light Mode** — Toggle with one tap
- 💾 **Offline Persistent** — All data saved to LocalStorage, survives page reloads

## 📊 Excel Report Sheets

| Sheet | Contents |
|---|---|
| 📋 Summary | Store overview — today, this week, all time |
| 📦 Stock & Sales | **Stock remaining + units sold per product** |
| 📈 Product Deep Dive | Rankings, margins, revenue share |
| 🧾 Txn Line Items | Every item from every sale |
| 📅 Daily Breakdown | Day-by-day sales history |
| ⚠️ Stock Alerts | Low/out-of-stock with restock recommendations |

## 🚀 How to Use

1. Open `index.html` in any browser (works on mobile too!)
2. Add your products in the **📦 Inventory** tab
3. Use the **🛒 Sell** tab to record sales
4. Check **🏠 Home** for today's summary
5. Export **📊 Analytics** → "Export Excel" for full report

## 🛠 Tech Stack

- **HTML5** + **CSS3** (CSS Variables, dark/light mode)
- **Vanilla JavaScript** (no frameworks)
- **SheetJS (xlsx)** for Excel export
- **LocalStorage** for data persistence
- **Google Fonts** (Inter)

## 📱 Mobile Optimized

Designed specifically for smartphone screens (375px–430px). Works great on:
- Chrome for Android
- Safari on iPhone
- Any mobile browser

---
Built with ❤️ using ShopTrack
