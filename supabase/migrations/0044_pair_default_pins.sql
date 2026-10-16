-- Cặp ghim cố định cho toàn bộ giải đấu, cấu hình từ /admin/settings.
--
-- Lưu trong site_settings thay vì hằng số trong code, để admin đổi được mà
-- không cần deploy lại. Giá trị: {"spec": "Hoà Hồ|Lê Hoạt"} — nhóm cách nhau
-- bằng `;`, tên trong nhóm cách nhau bằng `|`. Chuỗi rỗng = tắt.
--
-- Không khai báo policy mới: 0002_rls_policies.sql đã cho mọi người SELECT
-- site_settings và chỉ super admin được ghi.
INSERT INTO site_settings(key, value) VALUES
  ('pair_default_pins', '{"spec":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
