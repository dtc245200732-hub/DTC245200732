PETCARE SPA - FRONTEND UPDATE

1. Sao luu file hien tai:
   C:\Users\MHC\Downloads\petcare-spa\frontend\index.html

2. Giai nen goi nay, copy frontend\index.html moi vao:
   C:\Users\MHC\Downloads\petcare-spa\frontend\index.html
   Chon Replace/Thay the khi Windows hoi.

3. Mo VS Code va chay backend tu terminal:
   cd C:\Users\MHC\Downloads\petcare-spa\backend
   npm run dev

4. Kiem tra backend dang lang nghe cong 5001, vi file index.html nay goi:
   http://localhost:5001/api/services
   http://localhost:5001/api/pets
   http://localhost:5001/api/auth
   Neu backend cua ban dung cong 5000, sua API_BASE o dau the script trong index.html thanh:
   const API_BASE = 'http://localhost:5000/api';

5. Mo frontend bang Live Server tu VS Code (nen dung http://127.0.0.1:5500).

LUU Y QUAN TRONG:
- Dang ky/dang nhap va danh sach/danh muc dich vu + ho so thu cung goi API backend hien co.
- Cac man hinh lich hen, lich lam viec, hoa don, lich su cham soc, bao cao, quan ly nguoi dung/khach hang va cai dat trong ban nay dang la giao dien demo, luu tren localStorage cua trinh duyet.
- De dung that nhieu tai khoan/nhieu may, can tao API va bang PostgreSQL tuong ung; phan quyen quan trong phai duoc kiem tra o backend, khong chi an hien nut tren giao dien.
- Vai tro Admin/Staff khong duoc tu chon khi dang ky tai khoan Customer.
