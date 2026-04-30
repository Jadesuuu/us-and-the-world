import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// Configure the SDK exactly once at module load. v2 of the loader switched
// to a functional API — calling setOptions twice is a noop after the first
// call, but we guard anyway so HMR reloads don't warn.
let configured = false;
function configure() {
  if (configured) return;
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    v: "weekly",
    libraries: ["places"],
  });
  configured = true;
}

let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;

export function loadPlaces(): Promise<google.maps.PlacesLibrary> {
  if (!placesPromise) {
    configure();
    placesPromise = importLibrary("places");
  }
  return placesPromise;
}
