interface StarRatingProps {
  rating?: 1 | 2 | 3 | null;
  isFavorite?: boolean;
  size?: "sm" | "md";
}

export function StarRating({ rating, isFavorite, size = "sm" }: StarRatingProps) {
  if (!rating) {
    return (
      <span className={`star-rating star-rating-${size} star-rating-empty`} aria-label="Not rated">
        {"☆☆☆"}
      </span>
    );
  }

  const filled = rating;
  const empty = 3 - filled;
  const label = isFavorite
    ? `${filled} star${filled > 1 ? "s" : ""}, favorite`
    : `${filled} star${filled > 1 ? "s" : ""}`;

  return (
    <span
      className={`star-rating star-rating-${size}${isFavorite ? " star-rating-favorite" : " star-rating-rated"}`}
      aria-label={label}
    >
      {"★".repeat(filled)}{"☆".repeat(empty)}
    </span>
  );
}
