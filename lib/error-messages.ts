/**
 * Translate server error codes to Vietnamese user-facing messages.
 */
const ERROR_VI: Record<string, string> = {
  unauthorized: "Bạn chưa đăng nhập",
  forbidden: "Bạn không có quyền thực hiện",
  not_found: "Không tìm thấy",
  tournament_not_found: "Không tìm thấy giải đấu",
  match_not_found: "Không tìm thấy trận đấu",
  expired: "Phiên đã hết hạn",
  invalid_json: "Dữ liệu gửi không hợp lệ",
  invalid_payload: "Dữ liệu gửi không hợp lệ",
  invalid_name: "Tên không hợp lệ",
  empty_name: "Tên không được để trống",
  missing_token: "Thiếu mã host",
  missing_id: "Thiếu mã định danh",
  too_large: "Dữ liệu quá lớn",
  collision: "Trùng mã, hãy thử lại",
  backend_unconfigured: "Backend chưa cấu hình",
  db_error: "Lỗi cơ sở dữ liệu, thử lại sau",
  build_failed: "Tạo sơ đồ thất bại",
  // Tournament
  already_generated: "Sơ đồ thi đấu đã được tạo",
  not_enough_teams: "Chưa đủ đội (cần ít nhất 2 đội)",
  not_enough_players: "Chưa đủ thành viên",
  already_drawn: "Đã bốc thăm rồi — kết quả là cuối cùng",
  draw_in_progress: "Đang có phiên bốc thăm",
  already_shuffling: "Đang trong quá trình bốc thăm",
  already_shuffled_once: "Đã bốc thăm 1 lần — không bốc lại được",
  need_at_least_2: "Cần ít nhất 2 người tham gia",
  teams_exist: "Đội đã tồn tại — xoá đội trước khi bốc lại",
  groups_incomplete: "Vòng bảng chưa kết thúc — nhập đủ điểm trước",
  already_promoted: "Knockout đã được tạo trước đó",
  previous_round_incomplete:
    "Vòng trước chưa kết thúc — nhập đủ điểm trước khi sinh vòng mới",
  round_already_generated: "Vòng này đã được sinh trước đó",
  // Pair lobby
  name_taken: "Tên đã có người dùng",
  session_full: "Phòng đầy",
  locked: "Phòng đã khoá",
  pin_stage_over: "Đã bốc thăm — không ghim được nữa",
  pin_not_found: "Không tìm thấy nhóm đã ghim",
  pin_duplicate_ids: "Danh sách ghim bị trùng người",
  pin_invalid_size: "Số người ghim không hợp lệ (từ 2 đến số người mỗi nhóm)",
  pin_unknown_member: "Có người không còn trong phòng",
  pin_already_pinned: "Có người đã được ghim ở nhóm khác",
  tournament_mismatch: "Sai giải đấu",
  negative_score: "Điểm không được âm",
  tie_score: "Đang hoà — cần chênh điểm để kết thúc",
  match_not_in_scope: "Trận đấu không thuộc phạm vi của link này",
  missing_team: "Trận chưa đủ 2 đội",
  no_result_yet: "Chưa có kết quả bốc thăm",
  not_linked: "Phòng chưa liên kết với giải đấu",
  invalid_token: "Link không hợp lệ hoặc đã bị thu hồi",
  invalid_email: "Email không hợp lệ",
  user_not_registered:
    "Email chưa đăng ký FreeMinigame — yêu cầu họ đăng ký trước rồi mời lại",
  cannot_invite_self: "Không thể mời chính mình",
  cannot_remove_owner: "Không thể xoá chủ giải đấu",
  cannot_change_owner: "Không thể đổi vai trò chủ giải đấu",
  // Team mode (giải đồng đội)
  name_too_long: "Tên quá dài",
  add_failed: "Thêm thất bại, thử lại",
  insert_failed: "Tạo thất bại, thử lại",
  rubbers_locked: "Đã tạo lịch thi đấu — không thể đổi nội dung thi đấu",
  schedule_exists: "Lịch thi đấu đã được tạo",
  roster_below_minimum: "Đội sẽ không đủ VĐV tối thiểu cho các nội dung",
  gender_locked_in_lineup:
    "VĐV đang trong đội hình đôi nam/đôi nữ/đôi nam nữ — mở lại nội dung trước khi đổi giới tính",
  player_in_lineup: "VĐV đang trong đội hình một nội dung — gỡ khỏi đội hình trước",
  rubber_completed: "Nội dung đã có kết quả — mở lại trước khi sửa",
  rubber_walkover: "Nội dung đã xử thắng/hủy — chủ giải cần mở lại trước khi nhập điểm",
  tie_not_finished: "Trận đối đầu chưa đấu xong tất cả nội dung",
  tie_already_decided: "Trận đối đầu đã có đội thắng",
  // Tournament LIVE draw (/t/draw)
  session_already_active: "Đang có phiên bốc thăm khác — hủy phiên cũ trước",
  session_not_found: "Không tìm thấy phiên bốc thăm",
  session_not_active: "Phiên bốc thăm đã kết thúc",
  invalid_entrant: "Không thuộc danh sách bốc thăm",
  all_slots_full: "Đã hết chỗ trống",
  incomplete_assignment: "Chưa bốc đủ — còn người/đội chưa quay",
  entrant_not_drawn: "Chưa bốc thăm nên không thể quay lại",
  need_at_least_4_players: "Cần ít nhất 4 VĐV",
  need_even_players: "Số VĐV phải là số chẵn để ghép đôi",
  tags_unbalanced:
    "Số VĐV hai nhóm (Nam/Nữ) phải bằng nhau — gán tag cho tất cả VĐV trước",
  missing_tag: "VĐV chưa được gán nhóm Nam/Nữ — gán tag ở tab Thành viên",
  invalid_group_count: "Số bảng không hợp lệ (mỗi bảng cần ít nhất 2 đội)",
  invalid_team_count: "Số đội không hợp lệ (mỗi đội cần ít nhất 2 VĐV)",
  // Technique videos
  video_not_found: "Không tìm thấy video",
  invalid_rating: "Điểm đánh giá phải từ 1 đến 5",
  comment_empty: "Bình luận không được để trống",
  comment_too_long: "Bình luận tối đa 500 ký tự",
  comment_rate_limited: "Bạn bình luận quá nhanh, thử lại sau 1 phút",
  refresh_locked: "Đang có tiến trình cập nhật, thử lại sau",
  refresh_cooldown: "Động tác này vừa được cập nhật trong 1 giờ qua",
  refresh_failed: "Cập nhật thất bại, xem chi tiết lỗi ở bảng",
  no_candidates: "YouTube không trả về video nào — giữ nguyên danh sách cũ",
  no_videos_selected: "Không chọn được video nào — giữ nguyên danh sách cũ",
  setting_invalid_key: "Tên cấu hình không hợp lệ",
  setting_empty: "Giá trị không được để trống",
  setting_too_long: "Giá trị quá dài (tối đa 200 ký tự)",
  api_key_missing: "Chưa có key — nhập key hoặc đặt biến môi trường",
  api_key_test_failed: "Key không hợp lệ hoặc API từ chối",
  cron_batch_failed: "Chạy đợt cập nhật thất bại",
};

export function translateError(code: string | undefined | null): string {
  if (!code) return "Đã có lỗi xảy ra";
  if (code in ERROR_VI) return ERROR_VI[code]!;
  // If the error string already looks Vietnamese (has Vietnamese chars), pass through
  if (/[À-ỹ]/.test(code)) return code;
  // Default: return the code as-is (probably DB error message)
  return code;
}
