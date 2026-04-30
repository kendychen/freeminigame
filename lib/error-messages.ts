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
  db_error: "Lỗi cơ sở dữ liệu",
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
  tournament_mismatch: "Sai giải đấu",
  negative_score: "Điểm không được âm",
  tie_score: "Đang hoà — cần chênh điểm để kết thúc",
  match_not_in_scope: "Trận đấu không thuộc phạm vi của link này",
  missing_team: "Trận chưa đủ 2 đội",
  no_result_yet: "Chưa có kết quả bốc thăm",
  not_linked: "Phòng chưa liên kết với giải đấu",
  invalid_token: "Link không hợp lệ hoặc đã bị thu hồi",
};

export function translateError(code: string | undefined | null): string {
  if (!code) return "Đã có lỗi xảy ra";
  if (code in ERROR_VI) return ERROR_VI[code]!;
  // If the error string already looks Vietnamese (has Vietnamese chars), pass through
  if (/[À-ỹ]/.test(code)) return code;
  // Default: return the code as-is (probably DB error message)
  return code;
}
