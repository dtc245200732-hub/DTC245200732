/* PetCare Spa - bản vá chạy đầy đủ chức năng khi chưa có backend.
   Gắn vào index.html: <script src="offline-patch.js"></script> (đặt ngay trước </body>)
   - Có backend tại API_BASE: web dùng backend như cũ.
   - Không có backend: tự chuyển sang chế độ ngoại tuyến (lưu trong trình duyệt). */
(function () {
  'use strict';
  const P = 'petcare_offline_';
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(P + k)); return v ?? d; } catch (e) { return d; } };
  const wr = (k, v) => localStorage.setItem(P + k, JSON.stringify(v));
  const nextId = a => Math.max(0, ...a.map(x => Number(x.id))) + 1;

  if (!rd('users', null)) wr('users', [
    { id: 1, full_name: 'Quản trị viên', email: 'admin@petcare.vn', password: 'admin123', role: 'Admin' },
    { id: 2, full_name: 'Nhân viên', email: 'staff@petcare.vn', password: 'staff123', role: 'Staff' },
    { id: 3, full_name: 'Khách hàng', email: 'khach@petcare.vn', password: 'khach123', role: 'Customer' }
  ]);
  if (!rd('services', null)) wr('services', [
    { id: 1, name: 'Tắm rửa', category: 'Tắm rửa', description: 'Tắm, sấy khô, chải lông', price: 150000, duration_minutes: 45, is_active: true },
    { id: 2, name: 'Cắt tỉa lông', category: 'Grooming', description: 'Cắt tỉa tạo kiểu', price: 250000, duration_minutes: 60, is_active: true },
    { id: 3, name: 'Vệ sinh tai', category: 'Vệ sinh', description: 'Làm sạch tai', price: 80000, duration_minutes: 20, is_active: true },
    { id: 4, name: 'Cắt móng', category: 'Vệ sinh', description: 'Cắt và dũa móng', price: 50000, duration_minutes: 15, is_active: true }
  ]);
  if (!rd('pets', null)) wr('pets', []);

  function showBadge() {
    if (document.getElementById('offlineBadge')) return;
    const d = document.createElement('div');
    d.id = 'offlineBadge';
    d.textContent = 'Chế độ ngoại tuyến (không thấy backend) — dữ liệu lưu trong trình duyệt';
    d.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#fff5e5;color:#895d1c;padding:8px 12px;border-radius:8px;font-size:12px;z-index:50;box-shadow:0 4px 14px #0002';
    document.body.appendChild(d);
  }

  function offline(url, o) {
    const method = (o.method || 'GET').toUpperCase();
    const path = url.replace(API_BASE, '');
    const body = o.body ? JSON.parse(o.body) : {};
    const users = rd('users', []);
    const me = users.find(u => 'offline-' + u.id === localStorage.getItem('petcare_token'));
    const staff = me && ['Admin', 'Staff'].includes(me.role);
    const err = m => { throw new Error(m); };
    showBadge();

    if (path === '/auth/register') {
      if (users.some(u => u.email === body.email)) err('Email đã được đăng ký.');
      users.push({ id: nextId(users), full_name: body.full_name, email: body.email, password: body.password, role: 'Customer' });
      wr('users', users);
      return { message: 'Đăng ký thành công (chế độ ngoại tuyến). Hãy đăng nhập.' };
    }
    if (path === '/auth/login') {
      const u = users.find(x => x.email === body.email && x.password === body.password);
      if (!u) err('Sai email hoặc mật khẩu.');
      return { token: 'offline-' + u.id, user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role } };
    }

    const m = path.match(/^\/(services|pets)(?:\/(\d+))?$/);
    if (!m) err('API không tồn tại: ' + path);
    const key = m[1], id = m[2] ? Number(m[2]) : null;
    const list = rd(key, []);

    if (key === 'services') {
      if (method === 'GET') return list;
      if (!me || me.role !== 'Admin') err('Chỉ Admin được thay đổi dịch vụ.');
    } else if (!me) err('Vui lòng đăng nhập.');

    const own = p => staff || p.customer_id === me.id;
    if (method === 'GET') return key === 'pets' ? list.filter(own) : list;

    if (method === 'POST') {
      const item = { ...body, id: nextId(list) };
      if (key === 'pets') item.customer_id = (me.role === 'Admin' && body.customer_id) || me.id;
      list.push(item); wr(key, list); return item;
    }
    const i = list.findIndex(x => x.id === id);
    if (i < 0) err('Không tìm thấy dữ liệu.');
    if (key === 'pets' && !own(list[i])) err('Bạn không có quyền với thú cưng này.');
    if (method === 'PUT') {
      const keep = list[i].customer_id;
      list[i] = { ...list[i], ...body, id };
      if (key === 'pets') list[i].customer_id = (me.role === 'Admin' && body.customer_id) || keep;
    } else if (method === 'DELETE') list.splice(i, 1);
    wr(key, list);
    return { message: 'OK' };
  }

  // Khi không kết nối được backend thì dùng chế độ ngoại tuyến
  const origApi = window.apiRequest;
  window.apiRequest = async function (url, o) {
    o = o || {};
    try { return await origApi(url, o); }
    catch (e) {
      if (String(e.message).indexOf('Không kết nối được backend') === 0) return offline(url, o);
      throw e;
    }
  };

  // Sửa lỗi: sửa lịch hẹn bị báo trùng giờ với chính nó (id là chuỗi so với số)
  const origOpenAppt = window.openAppointmentForm;
  window.openAppointmentForm = function (id) {
    origOpenAppt(id);
    editingAppointmentId = (id === null || id === undefined || id === '') ? null : Number(id);
  };

  setTimeout(function () {
    loadServices().catch(function () {});
    if (isLoggedIn()) loadPets().catch(function () {});
  }, 300);
})();
