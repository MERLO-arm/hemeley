// Shared map utilities & API constants used across multiple pages.
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;

// Douala city center coordinates
export const DOUALA_CENTER = [4.0511, 9.7679];

// Custom marker icon
export const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const LocationPickerMap = ({ position, setPosition, onAddressChange }) => {
  const MapClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          if (data.display_name) onAddressChange(data.display_name);
        } catch (error) {
          console.error('Error getting address:', error);
        }
      },
    });
    return null;
  };

  const RecenterMap = ({ position: pos }) => {
    const map = useMap();
    useEffect(() => {
      if (pos) map.setView(pos, 16);
    }, [pos, map]);
    return null;
  };

  return (
    <MapContainer
      center={position || DOUALA_CENTER}
      zoom={14}
      style={{ height: '300px', width: '100%', borderRadius: '16px' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {position && <Marker position={position} icon={customIcon} />}
      <MapClickHandler />
      <RecenterMap position={position} />
    </MapContainer>
  );
};
