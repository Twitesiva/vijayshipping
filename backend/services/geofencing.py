from __future__ import annotations
import os
import math
import googlemaps
from geopy.distance import geodesic
from dotenv import load_dotenv

from dotenv import load_dotenv, find_dotenv

# Load .env from project root
load_dotenv(find_dotenv())

# Initialize Google Maps client
gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY")

# Validate key: ignore if missing or placeholder
if gmaps_key and ("your_google_maps_api_key_here" in gmaps_key or gmaps_key.strip() == ""):
    gmaps_key = None

gmaps = googlemaps.Client(key=gmaps_key) if gmaps_key else None

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the high-precision geodesic distance between two points using geopy.
    Returns distance in kilometers.
    """
    try:
        dist = geodesic((lat1, lon1), (lat2, lon2)).km
        return dist
    except Exception as e:
        print(f"Geopy distance error: {e}")
        # Mathematical Haversine Fallback
        R = 6371.0
        lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
        lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
        dlat, dlon = lat2_rad - lat1_rad, lon2_rad - lon1_rad
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

def get_address(lat: float, lon: float) -> str:
    """
    Perform reverse geocoding to get a cleaned human-readable address using Google Maps.
    """
    coord_str = f"({lat:.4f}, {lon:.4f})"
    if not gmaps:
        return f"Unknown Address {coord_str} - API Client Not Ready"

    try:
        # Reverse geocoding request
        reverse_geocode_result = gmaps.reverse_geocode((lat, lon))
        
        if reverse_geocode_result:
            # Use the first (usually most specific) result's formatted address
            return reverse_geocode_result[0].get('formatted_address', f"No Formatted Address {coord_str}")
        else:
            return f"No results found {coord_str}"
            
    except Exception as e:
        error_msg = str(e)
        print(f"Google Maps Geocoding error: {error_msg}")
        # Return the error message to help debug (e.g. Forbidden, REQUEST_DENIED, etc.)
        return f"Error: {error_msg[:50]}... {coord_str}"
    
    return f"Unknown Address {coord_str}"

def is_within_geofence(
    user_lat: float,
    user_lon: float,
    office_lat: float,
    office_lon: float,
    radius_km: float
) -> tuple[bool, float, str]:
    """
    Check if user location is within the geofence radius.
    Returns (is_inside, distance_km, address)
    """
    distance = calculate_distance(user_lat, user_lon, office_lat, office_lon)
    is_inside = distance <= radius_km
    address = get_address(user_lat, user_lon)
    return is_inside, distance, address
