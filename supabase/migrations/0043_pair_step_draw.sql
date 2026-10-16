-- Bốc thăm từng cặp cho phòng pair realtime.
--
-- Luồng cũ: host bấm 1 lần → server tính toàn bộ kết quả → ghi vào `result`.
-- Luồng mới: mỗi lần bấm chỉ rút nhóm kế tiếp từ những người chưa được chia,
-- nên `result` được bồi dần. Không có kết quả nào bị tính trước và lưu sẵn
-- (bảng này cho SELECT công khai, precompute = ai cũng đọc trước được).

-- Chế độ công bố: 'all_at_once' (cũ, mặc định) hoặc 'step' (quay từng nhóm).
ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS reveal_mode TEXT NOT NULL DEFAULT 'all_at_once';

ALTER TABLE pair_sessions
  DROP CONSTRAINT IF EXISTS pair_sessions_reveal_mode_check;
ALTER TABLE pair_sessions
  ADD CONSTRAINT pair_sessions_reveal_mode_check
  CHECK (reveal_mode IN ('all_at_once', 'step'));

-- Nhóm vừa quay ra ở lượt gần nhất, để mọi màn hình cùng chạy animation đúng
-- nhóm đó: {"index": 0, "ids": ["ab12", "cd34"], "fromPin": false}
ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS last_group JSONB;

-- Đã quay xong toàn bộ hay chưa (ở chế độ 'step').
ALTER TABLE pair_sessions
  ADD COLUMN IF NOT EXISTS draw_complete BOOLEAN NOT NULL DEFAULT false;
