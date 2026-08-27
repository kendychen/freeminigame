export type FormatGuide = {
  name: string;
  /** One sentence a first-timer can understand. */
  short: string;
  /** Who should pick it. */
  fit: string;
};

/** Plain-language explanation for every format a user can pick. */
export const FORMAT_GUIDE: Record<string, FormatGuide> = {
  random_pairs: {
    name: "Chia cặp ngẫu nhiên",
    short: "Trộn danh sách rồi ghép 2 người thành 1 cặp. Không có trận đấu, chỉ chia cặp.",
    fit: "Buổi giao lưu, cần ghép đôi nhanh cho công bằng.",
  },
  random_groups: {
    name: "Chia bảng ngẫu nhiên",
    short: "Trộn danh sách rồi chia thành các nhóm đều nhau. Không có trận đấu.",
    fit: "Chia bảng tay trước khi tự tổ chức đấu.",
  },
  single_elim: {
    name: "Loại trực tiếp (Single Elimination)",
    short: "Thua 1 trận là bị loại. Ít trận nhất, xong nhanh nhất.",
    fit: "Đông đội, ít sân, ít thời gian. Mỗi đội đấu ít nhất 1 trận.",
  },
  double_elim: {
    name: "Loại 2 lần thua (Double Elimination)",
    short: "Thua 1 trận rơi xuống nhánh thua, thua lần 2 mới bị loại. Công bằng hơn, nhiều trận hơn.",
    fit: "Muốn đội mạnh không bị loại oan vì 1 trận xui. Mỗi đội đấu ít nhất 2 trận.",
  },
  round_robin: {
    name: "Vòng tròn (Round Robin)",
    short: "Mọi đội gặp nhau đủ 1 lượt, xếp hạng theo điểm. Nhiều trận nhất.",
    fit: "Ít đội (4–8), muốn ai cũng được đấu nhiều.",
  },
  swiss: {
    name: "Thụy Sĩ (Swiss)",
    short: "Mỗi vòng ghép các đội có điểm gần nhau. Không ai bị loại, số vòng cố định.",
    fit: "Đông đội (12+) nhưng vẫn muốn mỗi đội đấu nhiều trận, thời gian có hạn.",
  },
  group_knockout: {
    name: "Vòng bảng + Loại trực tiếp",
    short: "Chia bảng đấu vòng tròn, đội đứng đầu bảng vào vòng loại trực tiếp. Như World Cup.",
    fit: "Giải chính thức 8–32 đội, có thời gian cả ngày.",
  },
  pic: {
    name: "PIC xoay cặp",
    short: "Mỗi vòng đổi bạn cặp, tính điểm cho từng cá nhân. Người điểm cao nhất thắng.",
    fit: "Giao lưu cá nhân, không có đội cố định.",
  },
};

export const FORMAT_KEYS = Object.keys(FORMAT_GUIDE);
