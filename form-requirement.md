Buatkan arsitektur form terbaik untuk aplikasi menggunakan Next.js App Router dengan TypeScript, dengan standar enterprise production-ready.

Gunakan stack modern berikut:

* React Hook Form untuk form state management
* Zod untuk validation schema
* shadcn/ui untuk komponen UI
* Tailwind CSS untuk styling

Saya ingin hasil yang scalable, clean, reusable, maintainable, dan siap dipakai untuk project besar.

Requirement utama:

1. Struktur folder harus rapi dan scalable:

* components/forms
* schemas
* hooks
* lib
* services
* types

2. Pisahkan concern dengan pattern:

* schema validation terpisah
* form UI terpisah
* submit logic terpisah
* API request terpisah
* reusable helper terpisah

3. Buat reusable component:

* FormInput
* FormSelect
* FormTextarea
* FormDatePicker
* FormCheckbox
* FormRadio
* FormNumber
* FormCurrency
* FormAsyncSelect

4. Gunakan TypeScript strict typing:

* tanpa any
* type inference dari schema
* generic reusable component

5. Form harus support fitur modern:

* realtime validation
* loading submit
* dirty state detection
* disable submit jika invalid
* reset form
* async default value
* dynamic field array
* nested object field
* array field

6. Tambahkan smart form UX global:

* auto focus ke field error pertama
* debounce submit
* prevent double submit
* confirm leave page jika ada perubahan
* enter untuk pindah field berikutnya
* keyboard navigation
* loading indicator per field jika async
* smart placeholder
* smart helper text

7. Tambahkan enterprise behavior:

* dependent field
* conditional rendering field
* auto calculate field
* auto trigger field berdasarkan field lain
* async select search
* server side validation mapping
* global form error toast
* section collapse per group form
* multi-step form support

8. Tambahkan custom hook:

* useFormSubmit
* useFormErrorHandler
* useDirtyFormGuard
* useAsyncOptions

9. Tambahkan best practice submit pattern:

* optimistic UX
* centralized error handling
* reusable mutation handler
* clean async await pattern

10. Tambahkan contoh implementasi lengkap:

* User Form
* Product Form
* Transaction Form

11. UI harus cocok untuk dashboard enterprise / POS:

* layout rapi
* label konsisten
* spacing nyaman
* cepat untuk input data besar
* nyaman dipakai operator
* professional look seperti ERP modern

12. Gunakan coding style senior developer:

* clean naming
* reusable logic
* maintainable architecture
* mudah scaling project besar

13. Hasil akhir harus seperti boilerplate enterprise modern setara standar aplikasi dashboard besar, mudah dikembangkan, dan siap production.
