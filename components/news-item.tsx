import Image from "next/image";
import { SOURCE_LABELS } from "@/lib/news-sources";

interface Props {
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  kind: "special" | "new_release";
  palateStars: 0 | 1 | 2 | 3;
  source: string;
}

function PalateStars({ stars }: { stars: 0 | 1 | 2 | 3 }) {
  if (stars === 0) return null;
  return <span className="news-item__stars" aria-label={`${stars} palate match`}>{"★".repeat(stars)}</span>;
}

function formatPrice(price: number) {
  return `R${price.toLocaleString("en-ZA")}`;
}


export function NewsItem({ name, price, originalPrice, discountPct, url, imageUrl, kind, palateStars, source }: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-item"
    >
      {imageUrl && (
        <div className="news-item__image">
          <Image src={imageUrl} alt={name} fill style={{ objectFit: "contain" }} unoptimized />
        </div>
      )}
      <div className="news-item__body">
        <p className="news-item__name">{name}</p>
        <p className="news-item__price">{formatPrice(price)}</p>
        {originalPrice && (
          <p className="news-item__original">was {formatPrice(originalPrice)}</p>
        )}
        {discountPct && (
          <p className="news-item__discount">-{discountPct}%</p>
        )}
        {kind === "new_release" && (
          <p className="news-item__badge">NEW</p>
        )}
        <PalateStars stars={palateStars} />
        <p className="news-item__source">{SOURCE_LABELS[source] ?? source}</p>
      </div>
    </a>
  );
}
