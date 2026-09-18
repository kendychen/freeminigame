-- 0042_pair_split_by_tag.sql — LIVE bảng cho chế độ "Bảng nam & bảng nữ riêng".
--
-- pair_sessions chỉ có group_size (một cỡ bảng duy nhất) nên không diễn tả được
-- "3 bảng nam 6 người + 2 bảng nữ 5 người". Thêm group_plan: mảng
-- [{ "size": 6, "tag": "Nam" }, ...] theo đúng thứ tự bảng A, B, C…
-- draw_mode mới 'split_by_tag': mỗi bảng chỉ nhận người mang tag của bảng đó.
-- Idempotent — an toàn khi chạy lại.

ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS group_plan JSONB;

ALTER TABLE pair_sessions DROP CONSTRAINT IF EXISTS pair_sessions_draw_mode_check;
ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_draw_mode_check
  CHECK (draw_mode IN ('random_all','balanced_by_tag','split_by_tag'));

-- group_plan phải là mảng JSON (hoặc NULL cho các phiên cũ / chế độ khác).
ALTER TABLE pair_sessions DROP CONSTRAINT IF EXISTS pair_sessions_group_plan_check;
ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_group_plan_check
  CHECK (group_plan IS NULL OR jsonb_typeof(group_plan) = 'array');