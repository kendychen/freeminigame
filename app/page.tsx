import { getUiTheme } from "@/lib/ui-theme";
import { HomeV1 } from "@/components/home/HomeV1";
import { HomeV2 } from "@/components/home/HomeV2";

export default async function HomePage() {
  const theme = await getUiTheme();
  return theme === "v2" ? <HomeV2 /> : <HomeV1 />;
}
