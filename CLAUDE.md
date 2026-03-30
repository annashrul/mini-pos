Buatkan aplikasi POS (Point of Sale) modern, scalable, enterprise-ready menggunakan:

## Tech Stack

* Next.js fullstack (App Router)
* PostgreSQL
* Prisma ORM
* Tailwind CSS
* shadcn/ui
* NextAuth / JWT authentication
* React Hook Form
* Zod validation

Aplikasi harus clean architecture, reusable, modular, scalable, production ready.

---

# MODULE UTAMA

## 1. Authentication & Security

* Login
* Logout
* Role-based access control
* Multi-role:

  * Super Admin
  * Admin
  * Manager
  * Cashier
* Session management
* Password hashing
* Protected routes
* Permission per menu/action

---

## 2. Dashboard

Tampilkan:

* Total penjualan hari ini
* Total transaksi hari ini
* Pendapatan bulan ini
* Produk stok menipis
* Produk terlaris
* Grafik penjualan harian
* Grafik penjualan bulanan
* Transaksi terakhir
* Top cashier performance

---

## 3. Master Produk

Fitur:

* List produk
* Search produk
* Filter kategori
* Filter brand
* Filter supplier
* Pagination
* Infinite scroll optional
* Tambah produk
* Edit produk
* Hapus produk
* Detail produk
* Upload gambar produk
* Multi barcode
* SKU otomatis

Field:

* kode produk
* nama produk
* kategori
* brand
* supplier
* harga beli
* harga jual
* margin
* stok minimum
* barcode
* satuan
* status aktif/nonaktif
* deskripsi

---

## 4. Kategori Produk

CRUD kategori:

* nama kategori
* deskripsi
* icon optional

---

## 5. Brand Produk

CRUD brand

---

## 6. Supplier Management

CRUD supplier:

* nama supplier
* kontak
* alamat
* email
* status aktif

---

## 7. Customer Management

CRUD customer:

* nama
* no hp
* email
* alamat
* member level
* total belanja

---

## 8. Membership / Loyalty Program

* Point reward
* Membership level
* Diskon member
* History point

---

## 9. POS Transaction (Kasir)

Fitur:

* Scan barcode
* Search produk
* Add cart
* Edit qty
* Remove item
* Diskon per item
* Diskon global
* Pajak
* Voucher
* Promo otomatis
* Split payment
* Multi payment:

  * Cash
  * Transfer
  * QRIS
  * E-wallet
* Hitung kembalian otomatis
* Print invoice thermal
* Generate invoice otomatis

---

## 10. Transaction Hold / Pending

* Hold transaksi
* Resume transaksi

---

## 11. Return / Refund

* Return item
* Refund transaksi
* Partial refund

---

## 12. Stock Management

* Stock masuk
* Stock keluar
* Penyesuaian stok
* Stock opname
* Transfer stock antar branch
* History stock movement

---

## 13. Purchase Module

* Purchase order
* Penerimaan barang
* Supplier invoice

---

## 14. Multi Branch / Multi Store

* Branch management
* Produk per branch
* Stock per branch
* Harga per branch

---

## 15. Shift Kasir

* Open shift
* Close shift
* Cash summary
* Selisih kas

---

## 16. Approval System

* Approval diskon besar
* Approval void transaksi

---

## 17. Void Transaction

* Void transaksi dengan alasan
* Approval manager

---

## 18. Expense Management

* Pengeluaran operasional
* Catatan biaya harian

---

## 19. Reports

Laporan:

* Penjualan harian
* Penjualan bulanan
* Penjualan tahunan
* Produk terlaris
* Produk tidak laku
* Laba rugi sederhana
* Margin produk
* Laporan kasir
* Laporan branch
* Laporan supplier
* Laporan customer

---

## 20. Audit Log

Catat semua aktivitas:

* login
* edit produk
* hapus transaksi
* ubah harga

---

## 21. Notification System

* stok menipis
* produk expired
* transaksi gagal

---

## 22. Promo Engine

* diskon kategori
* diskon item
* buy 1 get 1
* bundle promo
* voucher code

---

## 23. Barcode & Printing

* generate barcode
* print barcode
* thermal print invoice

---

## 24. Export Data

* export excel
* export pdf
* print report

---

## 25. UI/UX Requirement

Gunakan:

* modern clean design
* responsive
* soft shadow
* rounded-xl
* white theme
* loading skeleton
* empty state
* toast notification
* modal modern

Gunakan shadcn:

* table
* dialog
* select
* dropdown
* tabs
* form
* calendar
* command

---

## 26. Filter Advanced

Semua table support:

* search
* filter
* sort
* date range
* status filter
* branch filter

Jika filter kompleks:
gunakan modal filter dengan:

* searchable select
* infinite scroll select
* async data loading

---

## 27. Database Design

Schema lengkap:

* users
* roles
* permissions
* products
* categories
* brands
* suppliers
* customers
* transactions
* transaction_items
* payments
* stock_movements
* expenses
* branches
* audit_logs
* promotions

---

## 28. Technical Requirement

* Server actions
* Optimistic update
* Error handling lengkap
* Validation lengkap
* Reusable hooks
* Reusable table component
* Reusable modal form
* Clean folder structure

---

## Output yang diminta:

1. Folder structure lengkap
2. Prisma schema lengkap
3. Database relation lengkap
4. Dashboard UI
5. Semua module CRUD
6. POS transaction full flow
7. Reports
8. Authentication
9. Seed database dummy
10. Production-ready code structure
