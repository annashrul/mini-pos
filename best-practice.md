Tujuan:
Project harus siap production, mudah di-maintain tim besar, clean code, reusable, performa baik, mudah dikembangkan, serta mendukung shared contract antara frontend dan backend dalam satu codebase.

Standar wajib:

1. Gunakan arsitektur feature-based enterprise + full stack shared architecture:

conoh nya kurang lebih seperti iin
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── products/
│   │   ├── transactions/
│   │
│   ├── dashboard/
│   ├── products/
│   ├── users/
│   └── layout.tsx
│
├── components/
│   ├── ui/
│   ├── common/
│   ├── layouts/
│
├── features/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── transactions/
│
├── server/
│   ├── services/
│   ├── repositories/
│   ├── actions/
│
├── shared/
│   ├── types/
│   ├── interfaces/
│   ├── dto/
│   ├── schemas/
│   ├── enums/
│   ├── constants/
│   ├── utils/
│
├── hooks/
├── services/
├── context/
├── lib/
├── constants/
├── types/
├── schemas/

2. Setiap feature wajib memiliki:

* components
* hooks
* services
* types
* schemas
* utils

Contoh:
features/products/
├── components/
├── hooks/
├── services/
├── types/
├── schemas/
├── utils/

3. Terapkan separation of concern secara ketat:

* UI hanya render tampilan
* logic di custom hook
* API di service layer frontend
* validasi di schema
* helper di lib/utils
* business logic backend di server/services
* query data di server/repositories

4. Gunakan shared contract antara frontend dan backend:
   shared/

* interfaces = entity contract
* dto = request/response contract
* schemas = validation contract
* enums = status/role contract
* types = generic reusable type

5. Semua frontend dan backend wajib memakai shared contract yang sama.

6. Gunakan TypeScript strict:

* dilarang any
* semua props typed
* semua response API typed
* gunakan interface/type reusable

7. Semua form wajib menggunakan:

* react-hook-form
* zod
* reusable smart form wrapper

8. Form behavior wajib modern:

* realtime validation
* disabled submit saat invalid
* loading submit
* reset form
* error server handling
* dirty state detection

9. Gunakan state management modern:

* Context API untuk global state ringan
* provider terpisah per domain
* hindari prop drilling

10. Semua API wajib melalui service layer frontend:
    Pattern:
    fetch → feature service → hook → component

11. route.ts hanya endpoint tipis:

* parse request
* validate body
* call server service
* return response

12. Business logic backend tidak boleh di route.ts

13. Gunakan server layer:
    server/services/product.service.ts
    server/repositories/product.repository.ts

14. Pattern backend:
    route.ts → server service → repository

15. Semua validation frontend dan backend memakai schema shared yang sama menggunakan zod.

16. Semua API response wajib memakai generic:
    ApiResponse<T>

17. Gunakan reusable smart table enterprise:

* debounce search
* sort multi column
* pagination
* select all
* bulk delete
* bulk update
* hide/unhide column
* sticky header
* advanced filter modal
* loading skeleton
* empty state
* row action dropdown

18. Gunakan reusable modal system:

* create
* edit
* delete confirmation
* dynamic size
* scroll safe

19. Gunakan reusable dialog action:

* confirm action
* destructive action
* warning action

20. Gunakan reusable utility:
    lib/

* formatCurrency
* formatDate
* formatNumber
* debounce
* classnames helper

21. Gunakan constants:
    constants/

* routes.ts
* roles.ts
* permissions.ts
* labels.ts
* table-config.ts

22. Pisahkan server component dan client component dengan disiplin:

* default server component
* gunakan "use client" hanya saat butuh state/interaksi

23. Semua page data wajib memiliki:

* loading.tsx
* error.tsx
* empty state
* skeleton loading

24. Gunakan clean naming:

* product-table.tsx
* user-form.tsx
* auth-provider.tsx
* use-product.ts
* product.service.ts
* product.repository.ts
* product.interface.ts
* product.schema.ts

25. Hindari file besar:
    maksimal 200 baris/file, jika lebih wajib dipecah.

26. Gunakan reusable layout:

* sidebar modern
* header
* breadcrumb
* content wrapper

27. Sidebar harus modern:

* collapsible
* active menu
* nested menu
* icon support

28. Dashboard UI harus professional:

* clean spacing
* soft modern design
* responsive
* enterprise look
* tidak berantakan

29. Gunakan shadcn/ui sebagai base component.

30. Gunakan pattern clean folder:
    feature internal tidak boleh bocor ke feature lain kecuali lewat export index.

31. Tambahkan contoh implementasi:

* dashboard
* products CRUD
* users CRUD
* smart table reusable
* smart form reusable
* modal reusable

32. Tambahkan best practice performa:

* memoization jika perlu
* lazy load komponen berat
* server fetch jika memungkinkan

33. Hasil akhir harus seperti codebase production perusahaan besar:
    rapi, konsisten, scalable, reusable, mudah onboarding developer baru, dan siap untuk tim besar.
