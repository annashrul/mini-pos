---
name: project-progress-summary
description: Complete summary of all features built, refactored, and configured in the NusaPOS application across multiple conversations
type: project
---

# NusaPOS — Project Progress Summary (per 6 April 2026)

## Tech Stack
- Next.js (App Router, Turbopack), PostgreSQL, Prisma ORM, Tailwind CSS, shadcn/ui, NextAuth JWT, React Hook Form, Zod, Recharts, @dnd-kit/core, Socket.IO + SSE

---

## 1. MODUL AKUNTANSI (Full)

### Database Models
- `AccountCategory` — 5 tipe: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `Account` — Chart of Accounts dengan hierarki parent/child, per-branch support
- `JournalEntry` + `JournalEntryLine` — Double-entry bookkeeping, status DRAFT/POSTED/VOIDED
- `AccountingPeriod` — OPEN/CLOSED/LOCKED lifecycle

### Server Actions (`src/server/actions/accounting.ts` + `accounting-reports.ts`)
- COA: getAccountCategories, getAccounts, getAccountTree, createAccount, updateAccount, deleteAccount
- Journal: getJournalEntries, createJournalEntry, updateJournalEntry, postJournalEntry, voidJournalEntry
- Auto-journal: createAutoJournal (TRANSACTION, PURCHASE, RETURN, DEBT_PAYMENT, EXPENSE)
- Reports: getGeneralLedger, getTrialBalance, getIncomeStatement, getBalanceSheet, getCashFlow, getAccountingDashboard
- Periods: getAccountingPeriods, createAccountingPeriod, closePeriod, reopenPeriod, lockPeriod
- Seed: seedDefaultCOA (5 categories + 11 system accounts)

### Feature Architecture (`src/features/accounting/`)
Refactored to proper structure:
- `types/accounting.type.ts` — All interfaces (Account, Journal, Ledger, Report types)
- `utils/accounting.util.ts` — STATUS_CONFIG, TYPE_CONFIG, CATEGORY_CONFIG, formatters
- `services/accounting.service.ts` — Aggregated server actions
- `hooks/` — 7 hooks: use-accounting-dashboard, use-coa, use-journals, use-journal-form, use-ledger, use-accounting-reports, use-periods
- `components/` — 9 components all redesigned with modern UI

### Auto-Journal Integration
Fire-and-forget calls added to:
- `transactions.ts` → createAutoJournal("TRANSACTION")
- `purchases.ts` → createAutoJournal("PURCHASE")
- `expenses.ts` → createAutoJournal("EXPENSE")
- `returns.ts` → createAutoJournal("RETURN")
- `debts.ts` → createAutoJournal("DEBT_PAYMENT")

### Seed Data
- 24 accounts (COA) with opening balances
- 4 accounting periods (1 LOCKED, 2 CLOSED, 1 OPEN)
- 81 journal entries spanning 3 months (sales, purchases, expenses, payroll, depreciation, etc.)

### UI Design
- Dashboard: KPI cards, revenue trend chart, top expenses, recent journals
- COA: hierarchical tree with category colors, search, expand/collapse
- Journals: SmartTable with filters (status, date range), row click for detail
- Journal Form: Sheet with dynamic line items, balance validation, account combobox
- Ledger: Account combobox + date presets (Bulan Ini/Lalu/3 Bulan/Tahun Ini/Custom) with DatePicker
- Reports: 4 tabs with preset date filters
  - Neraca Saldo: grouped by category, balance indicator
  - Laba Rugi: hero card + revenue/expense side-by-side
  - Neraca: summary cards + 2-column layout + balance equation bar
  - Arus Kas: waterfall cards + cash in/out sections
- Periods: SmartTable with status badges, close/reopen/lock actions, RHF+Zod create form with DatePicker

---

## 2. REFACTORED FEATURES (Architecture)

All refactored to: types/ → utils/ → services/ → hooks/ → components/

### Reports (`src/features/reports/`)
- 1,348 lines → 12 files
- hooks/use-reports-data.ts, 7 tab components, skeleton, shared utils

### Analytics / Business Intelligence (`src/features/analytics/`)
- 1,252 lines → 25 files
- 7 hooks, 9 section components, shared helpers (RankBadge, SectionHeader, EmptyState)

### Customer Intelligence (`src/features/customer-intelligence/`)
- 569 lines → 17 files
- 3 hooks, 5 components, shared CustomerAvatar

### Accounting — see above

---

## 3. KITCHEN DISPLAY SYSTEM (Full)

### Database
- `OrderQueue` — queueNumber, status (NEW/PREPARING/READY/SERVED/CANCELLED), priority, notes, tableId
- `OrderQueueItem` — productName, quantity, notes, status (PENDING/PREPARING/DONE)

### Server Actions (`src/server/actions/order-queue.ts`)
- getOrderQueue, createOrderFromTransaction, createManualOrder
- updateOrderStatus, advanceOrderStatus, updateOrderItemStatus
- cancelOrder, getQueueStats, resetDailyQueue

### Realtime (SSE)
- Events: ORDER_QUEUE_CREATED, ORDER_QUEUE_UPDATED, ORDER_QUEUE_CANCELLED
- `src/hooks/use-kitchen-socket.ts` — SSE listener with 1s debounce
- Fallback polling every 30s

### POS → Kitchen Integration
- Conditional: checks `kitchen.enabled` OR `pos.autoSendKitchen` setting
- `createOrderFromTransaction(transactionId)` called fire-and-forget after transaction
- Transaction notes (customer name) passed to OrderQueue.notes

### Speech Announcements (Web Speech API)
- "Ada antrian baru" — when new order arrives
- "Pesanan atas nama [nama] sedang diproses" — when status changes
- Falls back to "Nomor antrian X" if no customer name
- Customer name extracted from `order.notes` ("Atas nama: X") or `transaction.customer.name`
- Beep sound (`/public/sounds/notification.wav`) + speech with 400ms delay
- Sound toggle in UI, pre-initialized on first user click

### Drag and Drop (@dnd-kit/core)
- DndContext wraps kanban board
- DroppableColumn per status column
- DraggableOrderCard per order card
- Valid transitions only: NEW→PREPARING→READY→SERVED
- Optimistic UI update (instant move, API in background, revert on error)
- PointerSensor with 8px activation distance

### UI Design
- 4-column kanban: NEW (red), PREPARING (amber), READY (emerald), SERVED (gray)
- Gradient column headers, collapsible on mobile
- Order cards: left border accent, queue number, elapsed time, item list with checkboxes
- Stats bar: 7 metrics with ring effect on active counts
- Top bar: live clock, LIVE indicator, sound/dark mode toggles
- Full-width breakout from dashboard padding

---

## 4. POS ENHANCEMENTS

### Customer Name ("Atas Nama")
- Text input field in payment panel, before Member section
- Label changes by mode: "Atas Nama" (retail/cafe), "Atas Nama / No. Meja" (restaurant)
- Validation: if `requireCustomer` is true, must fill name OR have registered member
- Sent as `notes: "Atas nama: [nama]"` in transaction
- Reset on POS clear

### Auto-Insert Customer
- When phone >= 10 digits AND customer not found AND name is filled → auto-register via `quickRegisterCustomer(name, phone)`
- When existing customer found → auto-fill name field
- `quickRegisterCustomer` in `src/server/actions/customers.ts`

### Restaurant Mode
- `businessMode` setting: "retail" | "restaurant" | "cafe"
- Switching to restaurant/cafe auto-enables: requireCustomer, showTableNumber, autoSendKitchen
- Settings UI: Select dropdown + conditional toggle switches

### Table Management
- `RestaurantTable` model: number, name, capacity, status, section, branchId
- `tableId` on Transaction and OrderQueue
- Server actions: `src/server/actions/tables.ts` (getTables, createTable, updateTableStatus, occupyTable, releaseTable)
- Query returns global + branch-specific tables
- 17 seed tables: 8 Indoor, 6 Outdoor, 3 VIP

### Table Grid in POS
- Tab "Meja" in left panel (visible when showTableNumber = true)
- Grid grouped by section with status indicators
- Multi-select/merge: select multiple tables for 1 transaction
- Summary card: "Gabung Meja #1 + #2, Kapasitas total: 6 orang"
- Status colors: green (Available), red+pulse (Occupied), amber (Reserved), gray (Cleaning)
- Auto-mark OCCUPIED after payment, "Kosongkan" button on hover for occupied tables
- Notes: "Meja: 1+2 - Atas nama: Budi"

### Product Bundles (Paket)
- `ProductBundle` + `ProductBundleItem` models
- Server actions: `src/server/actions/bundles.ts` (getBundles, createBundle, updateBundle, deleteBundle, getActiveBundles)
- POS: "Paket" tab in left panel shows bundle cards with component list, price, savings badge
- Cart: bundle enters as 1 line item (not exploded), productId prefixed with `bundle:`
- Transaction backend: validates stock per component, deducts stock per component, stores as single transaction item with unitName "PAKET"
- 4 seed bundles: Paket Hemat Indomie, Paket Keluarga, Paket Minuman Segar, Paket Mie Komplit

### Realtime Config Sync
- Events: CONFIG_POS_UPDATED, CONFIG_RECEIPT_UPDATED, CONFIG_KITCHEN_UPDATED
- `src/hooks/use-config-socket.ts` — SSE listener, 2s debounce
- POS page auto-reloads config + tables when settings change
- Toast: "Konfigurasi POS diperbarui"

### Mobile/Tablet Layout Fixes
- Product panel: `md:w-[45%]` instead of fixed 280px
- Product grid: 2 cols mobile, 3 cols tablet, configurable desktop
- Bottom tab bar visible on tablet too (`lg:hidden`)
- Payment dialog: calculator limited to `max-h-[35vh]` on mobile
- Cart header visible on tablet

---

## 5. SIDEBAR & MENU

### Menu System
- `ensureAccessSeeded()` optimized: quick count check, only seeds missing menus, parallel upserts
- Sidebar cache versioned (`sidebar-menus-v3`), always fetches fresh + uses cache as preview
- Parent menu exact-match fix: `/accounting` doesn't highlight when on `/accounting/coa`
- `menuDefinedChildren` computed set for parent detection

### Registered Menus
- 6 Accounting menus (dashboard, coa, journals, ledger, reports, periods)
- Debts menu ("Hutang Piutang") in Keuangan group
- All with proper role permissions (SUPER_ADMIN, ADMIN, MANAGER)

---

## 6. DIALOG/FORM IMPROVEMENTS

### React Hook Form + Zod applied to:
- COA Account Dialog (DialogHeader/ScrollBody/DialogFooter structure)
- Accounting Period Create Dialog (DatePicker component)
- Employee Schedule Dialog (DatePicker, shift presets)
- Gift Card Issue Dialog (preset amounts, customer select)

### SmartTable applied to:
- Journals page (9 columns, 3 filters, row click, export)
- Returns page (stats cards + SmartTable)
- Inventory Forecast page (9 columns, risk filter, sort)
- `onRowClick` prop added to SmartTable component

### Returns Feature
- returns-content.tsx: SmartTable with status/type/date filters
- new-return-dialog.tsx: DialogHeader/ScrollBody/DialogFooter + RHF+Zod for form fields

---

## 7. KEY FILES REFERENCE

### Server Actions
- `src/server/actions/accounting.ts` — COA + Journals + Periods + Auto-journal
- `src/server/actions/accounting-reports.ts` — Ledger + Trial Balance + P&L + Balance Sheet + Cash Flow
- `src/server/actions/transactions.ts` — POS transactions (with bundle support)
- `src/server/actions/order-queue.ts` — Kitchen display orders
- `src/server/actions/tables.ts` — Restaurant table management
- `src/server/actions/bundles.ts` — Product bundle CRUD
- `src/server/actions/settings.ts` — Config with realtime emit (POS, Receipt, Kitchen)
- `src/server/actions/customers.ts` — quickRegisterCustomer
- `src/server/actions/debts.ts` — Hutang/Piutang with auto-journal

### Realtime (SSE)
- `src/lib/socket-emit.ts` — 10 event constants
- `src/lib/event-bus.ts` — SSE broadcast system
- `src/app/api/events/route.ts` — SSE endpoint
- `src/hooks/use-socket.ts` — useRealtimeEvents hook
- `src/hooks/use-dashboard-socket.ts` — Dashboard events
- `src/hooks/use-kitchen-socket.ts` — Kitchen events
- `src/hooks/use-config-socket.ts` — Config change events

### POS Feature
- `src/features/pos/components/pos-page.tsx` — Main POS orchestrator
- `src/features/pos/components/pos-page-panels.tsx` — 3-panel layout + TableGrid + BundleGrid
- `src/features/pos/hooks/use-pos-page-states.ts` — All POS state (80+ variables)
- `src/features/pos/hooks/use-pos-panels-context.tsx` — Context type
- `src/features/pos/types/pos.type.ts` — PosConfig type includes businessMode, showTableNumber, autoSendKitchen

### Kitchen Display
- `src/features/kitchen-display/components/kitchen-display-content.tsx` — Kanban + DnD + Speech
- `src/features/kitchen-display/components/order-card.tsx` — Order card with status actions
- `src/features/kitchen-display/components/queue-stats-bar.tsx` — Stats badges

---

## 8. PENDING / KNOWN ISSUES

- Prisma client regeneration blocked by dev server file lock on Windows — need to stop dev server and run `npx prisma generate` after schema changes
- Bundle management UI (CRUD page for creating/editing bundles) not yet built — currently only POS browsing and seed data
- Table management admin page not yet built — tables only manageable via seed/direct DB
- `_seeded` flag in access-control.ts resets on hot-reload causing slow first request in dev
