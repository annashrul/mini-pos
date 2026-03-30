Tambahkan global smart form behavior untuk seluruh aplikasi agar seluruh form terasa modern, cepat, cerdas, dan minim friction seperti software enterprise premium.

## Global Principle

Semua form harus:

* cepat digunakan
* meminimalkan klik
* meminimalkan perpindahan halaman
* mendukung data besar
* scalable untuk enterprise
* konsisten di seluruh aplikasi

Form harus terasa seperti software modern premium.

---

# Smart Relational Field Rule

Semua field yang mengambil data dari database wajib menggunakan relational smart select.

Contoh field:

* kategori
* supplier
* branch
* warehouse
* customer
* unit
* tax
* payment method
* brand
* role
* permission
* employee
* account mapping
* seluruh master data relational lainnya

---

# Relational Select Component Standard

Semua select relational wajib menggunakan:

* async search
* infinite scroll
* lazy loading
* debounced search
* server-side fetch

## Behavior

Saat select dibuka:

* data awal diambil bertahap
* bukan load seluruh data

Saat user scroll:

* load page berikutnya otomatis

Saat user mengetik:

* query langsung ke database

---

# Search Rule

Search harus:

* debounce 300ms
* support partial keyword
* support case insensitive
* support fast response

## Example

Ketik:

sup

langsung menemukan:

supplier utama

---

# Empty State Smart Action

Jika data kosong:

tampilkan:

No data found

dan:

* Create New

## Contoh

Kategori kosong:

No category found

* Create Category

---

# Inline Create Rule

Saat create ditekan:

* buka modal kecil
* create tanpa pindah halaman
* save langsung insert database

Setelah berhasil:

* data otomatis refresh
* data otomatis terpilih di field

---

# Auto Select After Create

Setelah master data berhasil dibuat:

* langsung menjadi selected value

Tanpa user memilih ulang.

---

# Smart Modal Rule

Modal create harus:

* kecil
* cepat
* fokus satu tugas
* tidak terlalu banyak field

---

# Smart Validation Rule

Validation harus realtime.

## Rule

Tampilkan validasi saat user mengetik.

Bukan setelah submit saja.

---

# Required Field UX

Field wajib:

* jelas terlihat
* indicator wajib halus
* tidak mengganggu visual

---

# Error Message Rule

Error message harus:

* pendek
* jelas
* langsung di bawah field

Contoh:

Category is required

---

# Duplicate Prevention Rule

Untuk field penting:

cek duplicate secara realtime.

Contoh:

Nama kategori sudah ada.

---

# Auto Focus Rule

Saat modal create dibuka:

cursor langsung aktif di field pertama.

---

# Keyboard Friendly Rule

Semua form harus nyaman untuk keyboard.

## Support:

* tab navigation
* enter submit
* esc close modal

---

# Smart Numeric Input Rule

Untuk angka:

gunakan format otomatis.

Contoh:

10000 → 10,000

---

# Currency Input Rule

Untuk harga:

* auto format currency
* tetap simpan raw numeric value

---

# Date Input Rule

Date field harus:

* mudah dipilih
* cepat
* support keyboard

---

# Multi Select Rule

Jika multi select:

gunakan tag style modern.

---

# Large Dataset Rule

Jika data sangat besar:

gunakan:

* cursor pagination
* virtual rendering bila perlu

---

# Smart Dependent Field Rule

Jika field bergantung pada field lain:

contoh:

subcategory tergantung category

maka:

subcategory disabled sebelum category dipilih.

---

# Auto Reset Dependent Field

Jika parent berubah:

child otomatis reset.

---

# Smart Loading State

Saat fetch data:

tampilkan loading kecil di dropdown.

---

# Smart Empty Search Result

Jika search tidak ditemukan:

No result found

* Create New

---

# Form Draft Protection

Jika user sudah mengetik lalu keluar:

beri warning perubahan belum disimpan.

---

# Dirty State Detection

Jika ada perubahan:

deteksi perubahan form otomatis.

---

# Save Button Intelligence

Button save:

* disabled jika tidak ada perubahan
* disabled jika invalid

---

# Optimistic UX

Setelah save:

UI langsung update cepat.

---

# Reusable Global Component Rule

Semua smart select wajib reusable global component.

## Tujuan

* konsisten
* mudah maintenance
* seluruh module memakai behavior sama

---

# Example UX Flow

Form Produk:

Category select →

search category →

jika kosong →

No category found

* Create Category

klik create →

modal create category →

save →

category otomatis masuk select →

otomatis selected

---

# Berlaku Untuk Semua Module

Rule ini wajib berlaku di seluruh aplikasi.
