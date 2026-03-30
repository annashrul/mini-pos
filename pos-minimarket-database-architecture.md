# POS Minimarket Database Architecture

Buatkan schema PostgreSQL enterprise untuk POS minimarket menggunakan Prisma ORM.

## Schema Lengkap

Core:

* users
* roles
* permissions
* branches
* devices
* sessions

Produk:

* products
* product_variants
* categories
* subcategories
* brands
* units
* barcodes
* product_prices
* product_cost_histories

Supplier:

* suppliers
* supplier_contacts
* supplier_payments

Customer:

* customers
* customer_points
* customer_levels

Transaksi:

* transactions
* transaction_items
* payments
* payment_methods
* refunds
* void_transactions

Stock:

* stock_movements
* stock_adjustments
* stock_opnames
* stock_transfers
* stock_reservations

Purchase:

* purchase_orders
* purchase_items
* goods_receipts

Promo:

* promotions
* promotion_rules
* vouchers
* bundles

Kasir:

* cashier_shifts
* cash_movements
* register_sessions

Audit:

* audit_logs
* activity_logs

## Database Requirement

* indexing strategy
* partition transaction table
* foreign key lengkap
* unique constraint tepat
* soft delete strategy
* created_by updated_by
* concurrency-safe stock update
