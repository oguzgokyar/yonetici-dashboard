import { Construction } from "lucide-react";

export function EmptyFeature({ title, description }: { title: string; description: string }) {
  return <div className="feature-empty"><div className="feature-empty-icon"><Construction size={30} /></div><span>YAKINDA</span><h2>{title}</h2><p>{description}</p></div>;
}
