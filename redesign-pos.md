Redesign halaman POS agar terlihat modern, rapi, nyaman dipakai lama, dan memiliki UX kasir profesional seperti software retail premium.

Gunakan stack:

* Next.js
* Tailwind CSS
* shadcn/ui

Target visual:

* clean
* modern
* premium
* fast cashier workflow
* enterprise retail software

---

# Fokus utama halaman POS

POS harus dirancang berdasarkan prioritas operasional kasir:

1. scan / cari produk harus paling cepat diakses
2. cart harus paling dominan
3. payment summary harus selalu terlihat jelas
4. tombol aksi utama mudah dijangkau
5. produk favorit dan kategori tetap cepat diakses
6. visual tidak padat

---

# Layout utama POS

Gunakan layout 3 area jelas:

## Left Sidebar

Sidebar lebih tenang dan tidak terlalu dominan.

Rule:

* width stabil
* icon konsisten
* active menu soft highlight
* spacing lega
* text tidak terlalu padat

---

## Main Center Area (zona utama kasir)

Area terbesar harus untuk transaksi.

Susunan:

### Bagian atas:

search barcode area sangat dominan

Search box harus:

* lebih tinggi
* lebih lebar
* sangat jelas
* menjadi fokus utama

Tambahkan:

* placeholder besar
* icon barcode jelas

---

### Shortcut action di samping search

Shortcut seperti F1 F2 F3 dibuat:

* seragam ukuran
* spacing konsisten
* visual secondary

Jangan terlalu dominan dibanding search.

---

### Produk favorit + kategori

Pisahkan lebih jelas.

Gunakan 2 panel:

## produk favorit

lebih besar

## kategori

lebih kecil

Produk favorit:

* card lebih rapi
* tinggi konsisten
* padding cukup
* hover jelas

Kategori:

* list lebih clean
* active category jelas
* spacing lebih lega

---

### Alert stok menipis

Jangan terlalu mencolok.

Gunakan:

* soft warning background
* icon kecil
* horizontal compact alert

---

### Cart area (paling dominan)

Keranjang harus area terbesar.

## Rule cart:

* tinggi lebih besar
* row lebih lega
* qty control lebih besar
* harga lebih jelas

Setiap row:

kiri:

* nama produk
* harga satuan

tengah:

* qty control

kanan:

* subtotal

hapus item kecil di kanan

---

## Qty control

Gunakan tombol:

[-] qty [+]

lebih besar dan mudah diklik.

---

## Cart scroll

Scroll halus.

Sticky cart header.

---

# Right Payment Panel

Panel kanan harus sangat jelas karena ini area keputusan transaksi.

## Payment card

Gunakan card premium:

* background putih
* shadow halus
* rounded besar

---

## Payment hierarchy

Urutan visual:

subtotal
diskon
pajak
voucher
total

## Total harus sangat dominan

Total:

* font besar
* bold
* spacing lega

---

## Diskon dan pajak

Jangan terlalu ramai.

Gunakan alignment rapi.

---

## Member input

Lebih kecil dari total.

---

## Voucher

Voucher area compact.

---

## Payment method

Dropdown lebih premium.

---

## Tombol bayar

Tambahkan tombol utama besar:

Bayar

Rule:

* full width
* warna primary dominan
* tinggi besar

Harus menjadi tombol paling dominan di panel kanan.

---

# Global spacing rule

Gunakan spacing lebih lega:

* antar card jelas
* antar section konsisten

Jangan terlalu rapat.

---

# Visual hierarchy

Prioritas visual:

1. search
2. cart
3. total pembayaran
4. produk favorit
5. kategori

---

# Warna

Gunakan karakter warna modern retail premium:

primary:
soft navy / soft teal

hindari terlalu banyak warna keras

---

# Card style

Semua card:

* rounded-xl / rounded-2xl
* border halus
* shadow sangat lembut

---

# Typography

Gunakan:

* Inter
* heading tegas
* angka transaksi sangat jelas

---

# Interaction UX

Hover semua elemen harus halus.

---

# POS operational rule

Kasir harus bisa bekerja cepat tanpa merasa layout berantakan.

Target UX:

sekali lihat langsung paham.

---

# Hindari

* terlalu banyak box kecil
* terlalu banyak border tebal
* ukuran elemen tidak konsisten
* area cart terlalu kecil
* payment kurang dominan

---

# Final target

POS harus terasa seperti software retail premium modern:

* nyaman dipakai lama
* cepat
* rapi
* profesional
* tidak melelahkan mata
