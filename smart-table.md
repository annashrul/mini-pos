Tambahkan global smart table behavior untuk seluruh aplikasi agar seluruh data list memiliki pengalaman seperti software enterprise modern.

## Global Table Principle

Semua table harus:

* cepat digunakan
* scalable untuk data besar
* nyaman untuk operasional harian
* minim klik
* modern enterprise
* konsisten di seluruh aplikasi

Table harus terasa seperti software premium enterprise.

---

# Table Visual Standard

Semua table wajib memiliki:

* rounded container
* white clean background
* subtle border
* sticky header
* soft row hover
* clean spacing
* modern density
* premium readability

---

# Sticky Header Rule

Header table harus sticky saat scroll vertikal.

Tujuan:

agar kolom tetap terlihat saat data panjang.

---

# Sticky Action Column Rule

Kolom action kanan wajib sticky.

Agar tombol action tetap terlihat saat scroll horizontal.

---

# Select Row Rule

Setiap row wajib memiliki checkbox.

## Support:

* select single row
* select multiple row
* select all current page

---

# Select All Behavior

Saat select all ditekan:

muncul pilihan:

* select current page
* select all filtered data

## Tujuan

Mendukung bulk operation skala besar.

---

# Bulk Action Bar

Jika row dipilih:

muncul bulk action bar.

Contoh action:

* delete
* export
* update status
* assign branch
* print

---

# Smart Filter Rule

Jika filter lebih dari satu:

gunakan modal filter.

## Bukan:

banyak filter memenuhi area table.

## Gunakan:

button Filter → buka modal filter

---

# Filter Modal Standard

Filter modal harus:

* clean
* searchable
* spacious
* mudah dipakai

---

# Filter Modal Support

Support:

* multi filter
* relational filter
* date range
* numeric range
* status filter
* branch filter
* category filter

---

# Filter Select Behavior

Semua filter relational wajib:

* async search
* infinite scroll
* debounce search

Sama seperti smart form select.

---

# Smart Filter Experience ala SAP

Filter harus memiliki:

* active filter badge
* jumlah filter aktif terlihat

Contoh:

Filter (3)

---

# Applied Filter Preview

Setelah filter diterapkan:

tampilkan active filter chips di atas table.

Contoh:

Category: Beverage
Branch: Jakarta
Status: Active

---

# Filter Reset Rule

Harus ada:

Reset Filter

---

# Saved Filter Rule

Support saved filter preset.

Contoh:

User bisa simpan:

Today Sales
Low Stock Branch A
Active Supplier

---

# Column Visibility Rule

Support:

Hide / Unhide Column

---

# Column Selector UX

Gunakan:

Columns button

saat dibuka tampil:

checkbox semua kolom

User bisa pilih:

kolom mana tampil.

---

# Persist Column Preference

Preferensi kolom user disimpan.

Saat reload:

kolom tetap sesuai pilihan user.

---

# Sort Rule

Semua kolom sortable jika relevan.

Support:

* ascending
* descending

---

# Search Rule

Search table wajib:

* debounce
* realtime
* server-side query

---

# Search Scope Rule

Search harus global ke data penting.

---

# Pagination Rule

Pagination wajib modern.

## Support:

* page number
* next prev
* first last
* page size selector

---

# Page Size Selector

Contoh:

10
25
50
100

---

# Total Data Information

Tampilkan:

Showing 1–25 of 4,281 data

---

# Smart Pagination Rule

Jika data besar:

gunakan server-side pagination.

---

# Empty State Table

Jika kosong:

No data found

dan action jika perlu:

Create New

---

# Loading State Table

Saat loading:

gunakan skeleton modern.

---

# Horizontal Scroll Rule

Jika kolom banyak:

table tetap nyaman horizontal scroll.

---

# Dense Mode Rule

Support density mode:

* compact
* normal

---

# Export Rule

Table support:

* export excel
* export csv
* export pdf jika perlu

---

# Import Rule

Jika relevan:

support import data.

---

# Row Click Rule

Klik row bisa membuka detail jika relevan.

---

# Action Rule

Action utama tetap di kolom kanan.

Contoh:

* view
* edit
* delete

---

# Confirmation Rule

Action destructive wajib confirmation.

---

# Responsive Rule

Desktop prioritas utama.

---

# Performance Rule

Jika data besar:

gunakan virtual rendering bila perlu.

---

# Global Reusable Table Component

Seluruh table wajib reusable global component.

## Tujuan

* konsisten
* mudah maintenance
* behavior sama di seluruh module

---

# Enterprise UX Target

Table harus terasa seperti:

* SAP
* Oracle
* modern retail SaaS
* enterprise dashboard premium
