import "../../globals.css";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-transparent">{children}</div>;
}
