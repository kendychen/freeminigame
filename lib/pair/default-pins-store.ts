// Server-only: cặp ghim cố định toàn giải, lưu ở site_settings.pair_default_pins.
import { createServiceClient } from "@/lib/supabase/service";
import {
  fallbackPinSpec,
  parseDefaultPinSpec,
  parsePinSetting,
} from "./default-pins";

export const PAIR_PINS_KEY = "pair_default_pins";

/**
 * Chuỗi spec hiện hành. Ô cấu hình trong /admin/settings thắng; khi chưa có
 * hàng nào trong DB thì lùi về env `PAIR_DEFAULT_PINS` rồi hằng số built-in.
 * Một chuỗi rỗng đã lưu là cố ý tắt, nên không lùi tiếp về env.
 *
 * Không dùng `cache()`: admin đổi cấu hình thì lượt bốc kế tiếp phải thấy ngay.
 */
export async function getDefaultPinSpecString(): Promise<string> {
  try {
    const { data, error } = await createServiceClient()
      .from("site_settings")
      .select("value")
      .eq("key", PAIR_PINS_KEY)
      .maybeSingle();
    if (error) {
      console.error(`[pair-pins] read failed: ${error.message}`);
      return fallbackPinSpec();
    }
    const stored = data ? parsePinSetting(data.value) : null;
    return stored !== null ? stored.trim() : fallbackPinSpec();
  } catch (e) {
    console.error(`[pair-pins] read threw: ${(e as Error).message}`);
    return fallbackPinSpec();
  }
}

/** Cùng nguồn như trên, đã parse sẵn cho `applyDefaultPins`. */
export async function getDefaultPinSpec(): Promise<string[][]> {
  return parseDefaultPinSpec(await getDefaultPinSpecString());
}
