"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { readResponseMessage } from "@/lib/utils";

const RATING_LABELS: Record<number, string> = {
  1: "Don't like it",
  2: "Good / neutral",
  3: "Like it"
};

export function BottleRating({
  itemId,
  rating: initialRating,
  isFavorite: initialFavorite
}: {
  itemId: string;
  rating?: 1 | 2 | 3 | null;
  isFavorite?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<1 | 2 | 3 | null>(initialRating ?? null);
  const [isFavorite, setIsFavorite] = useState(initialFavorite ?? false);
  const [hovered, setHovered] = useState<1 | 2 | 3 | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function save(newRating: 1 | 2 | 3 | null, newFavorite: boolean) {
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/items/${itemId}/rating`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: newRating, isFavorite: newFavorite })
        });

        if (!response.ok) {
          setNotice({ tone: "error", text: await readResponseMessage(response, "Could not save rating.") });
          return;
        }

        router.refresh();
      } catch {
        setNotice({ tone: "error", text: "Could not save rating. Check your connection and try again." });
      }
    });
  }

  function handleStarClick(star: 1 | 2 | 3) {
    // Clicking the active rating clears it
    const newRating = rating === star ? null : star;
    const newFavorite = newRating === 3 ? isFavorite : false;
    setRating(newRating);
    setIsFavorite(newFavorite);
    save(newRating, newFavorite);
  }

  function handleFavoriteToggle() {
    if (rating !== 3) return;
    const newFavorite = !isFavorite;
    setIsFavorite(newFavorite);
    save(rating, newFavorite);
  }

  const displayRating = hovered ?? rating;

  return (
    <div className="bottle-rating">
      <div className="bottle-rating-stars" aria-label="Set rating">
        {([1, 2, 3] as const).map((star) => {
          const isActive = displayRating !== null && star <= displayRating;
          const isCurrentFavorite = isFavorite && rating === 3 && hovered === null;
          const starClass = isActive
            ? isCurrentFavorite ? "star-filled star-gold" : "star-filled"
            : "star-empty";

          return (
            <button
              aria-label={RATING_LABELS[star]}
              className={`star-btn ${starClass}`}
              disabled={isPending}
              key={star}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              title={RATING_LABELS[star]}
              type="button"
            >
              {isActive ? "★" : "☆"}
            </button>
          );
        })}
      </div>

      {rating !== null && (
        <p className="bottle-rating-label">
          {hovered ? RATING_LABELS[hovered] : RATING_LABELS[rating]}
        </p>
      )}

      {rating === 3 && (
        <button
          className={`bottle-rating-favorite${isFavorite ? " bottle-rating-favorite-active" : ""}`}
          disabled={isPending}
          onClick={handleFavoriteToggle}
          title={isFavorite ? "Remove from favorites" : "Mark as a favorite"}
          type="button"
        >
          {isFavorite ? "★ Favorite" : "☆ Mark as favorite"}
        </button>
      )}

      {notice ? (
        <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div>
      ) : null}
    </div>
  );
}
