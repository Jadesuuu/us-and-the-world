import { loadPlaces } from "@/lib/google-maps-loader";
import type { PlacePhoto, PlaceReview } from "@/components/SearchControl";

// Same shape SearchControl produces for a freshly-picked place, minus
// the location/coords that the pin already owns. Used by the pin
// drawer's pre-lived state to render Google's photos + reviews until
// the couple replaces them with their own.
export interface GooglePlaceDetails {
  name: string | null;
  address: string | null;
  rating: number | null;
  userRatingCount: number | null;
  photos: PlacePhoto[];
  reviews: PlaceReview[];
}

export function extractPlacePhoto(
  photo: google.maps.places.Photo,
): PlacePhoto | null {
  let ref: string | null = null;
  const directName = (photo as unknown as { name?: string }).name;
  if (typeof directName === "string" && directName.length > 0) {
    ref = directName.startsWith("places/") ? directName : null;
  } else {
    try {
      const uri = photo.getURI({ maxWidth: 400 });
      const m = uri.match(/places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+/);
      ref = m?.[0] ?? null;
    } catch {
      ref = null;
    }
  }
  if (!ref) return null;

  const attributions = (
    photo as unknown as {
      authorAttributions?: { displayName?: string }[];
    }
  ).authorAttributions;
  const attribution = attributions?.find(
    (a) => typeof a.displayName === "string" && a.displayName.length > 0,
  )?.displayName;

  return { ref, attribution };
}

export async function fetchGooglePlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails> {
  const lib = await loadPlaces();
  const place = new lib.Place({ id: placeId, requestedLanguage: "en" });
  await place.fetchFields({
    fields: [
      "displayName",
      "formattedAddress",
      "photos",
      "reviews",
      "rating",
      "userRatingCount",
    ],
  });

  const photos = (place.photos ?? [])
    .map(extractPlacePhoto)
    .filter((p): p is PlacePhoto => p != null);

  const reviews: PlaceReview[] = (place.reviews ?? [])
    .slice(0, 5)
    .map((r) => ({
      author: r.authorAttribution?.displayName ?? "Anonymous",
      rating: r.rating ?? 0,
      text: r.text ?? "",
      timeDescription: r.relativePublishTimeDescription ?? "",
    }));

  return {
    name: place.displayName ?? null,
    address: place.formattedAddress ?? null,
    rating: typeof place.rating === "number" ? place.rating : null,
    userRatingCount:
      typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    photos,
    reviews,
  };
}
