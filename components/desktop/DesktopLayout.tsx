"use client";

import { type RefObject } from "react";
import Map, { type LatLng, type MapHandle } from "@/components/Map";
import type { Pin } from "@/hooks/usePins";
import type { ResolvedPlace } from "@/components/SearchControl";
import DesktopHeader from "./DesktopHeader";
import DesktopSidebar from "./DesktopSidebar";

interface Props {
  // Refs
  mapRef: RefObject<MapHandle>;

  // State
  selectedPin: Pin | null;
  selectedLatLng: LatLng | null;
  isAddOpen: boolean;
  pendingLatLng: LatLng | null;
  pendingPrefillTitle: string;
  pendingPrefillPlaceId: string | null;
  recentlyAddedId: string | null;
  previewPlace: ResolvedPlace | null;

  // Handlers
  onMarkerClick: (pinId: string) => void;
  onMapClick: (latlng: LatLng) => void;
  onSelectPin: (pinId: string) => void;
  onCloseDetail: () => void;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  onSubmittedAdd: (newPinId: string) => void;
  onOpenExistingFromAdd: (pinId: string) => void;
  onPlacePick: (place: ResolvedPlace) => void;
  onClosePreview: () => void;
  onDropDreamFromPreview: () => void;
}

export default function DesktopLayout(props: Props) {
  return (
    <div className="flex h-full flex-1 flex-col">
      <DesktopHeader onPlacePick={props.onPlacePick} />

      <div className="flex flex-1 overflow-hidden">
        <DesktopSidebar
          selectedPin={props.selectedPin}
          isAddOpen={props.isAddOpen}
          pendingLatLng={props.pendingLatLng}
          pendingPrefillTitle={props.pendingPrefillTitle}
          pendingPrefillPlaceId={props.pendingPrefillPlaceId}
          previewPlace={props.previewPlace}
          onSelectPin={props.onSelectPin}
          onCloseDetail={props.onCloseDetail}
          onOpenAdd={props.onOpenAdd}
          onCloseAdd={props.onCloseAdd}
          onSubmittedAdd={props.onSubmittedAdd}
          onOpenExistingFromAdd={props.onOpenExistingFromAdd}
          onClosePreview={props.onClosePreview}
          onDropDreamFromPreview={props.onDropDreamFromPreview}
        />

        <div className="flex-1">
          <Map
            ref={props.mapRef}
            initialZoom={1.6}
            onMarkerClick={props.onMarkerClick}
            onMapClick={props.onMapClick}
            pendingLatLng={props.isAddOpen ? props.pendingLatLng : null}
            previewLatLng={
              props.previewPlace
                ? {
                    lat: props.previewPlace.lat,
                    lng: props.previewPlace.lng,
                  }
                : null
            }
            selectedLatLng={props.selectedLatLng}
            recentlyAddedId={props.recentlyAddedId}
          />
        </div>
      </div>
    </div>
  );
}
