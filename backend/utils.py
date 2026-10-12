import math
from typing import Tuple, Optional
import os

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    distance = R * c
    return round(distance, 2)

def calculate_delivery_fee(distance_km: float) -> float:
    """
    Calculate delivery fee based on distance
    """
    base_fee = float(os.environ.get('DELIVERY_BASE_FEE', 500))
    per_km = float(os.environ.get('DELIVERY_PER_KM', 100))
    
    return base_fee + (distance_km * per_km)

async def find_nearest_available_delivery(db, vendor_lat: float, vendor_lon: float) -> Optional[dict]:
    """
    Find nearest available delivery partner
    """
    # Get all available delivery partners
    delivery_partners = await db.delivery_partners.find({
        "is_available": True,
        "is_active": True,
        "current_latitude": {"$exists": True},
        "current_longitude": {"$exists": True}
    }, {"_id": 0}).to_list(100)
    
    if not delivery_partners:
        return None
    
    # Calculate distances and find nearest
    nearest = None
    min_distance = float('inf')
    
    for partner in delivery_partners:
        distance = calculate_distance(
            vendor_lat, vendor_lon,
            partner['current_latitude'], partner['current_longitude']
        )
        
        if distance < min_distance:
            min_distance = distance
            nearest = partner
    
    return nearest

def is_menu_available(menu: dict) -> bool:
    """
    Check if menu is currently available based on its availability settings
    """
    if not menu.get('is_active', True):
        return False
    
    availability = menu.get('availability', {})
    avail_type = availability.get('type', 'always')
    
    if avail_type == 'always':
        return True
    
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    # Check time range
    if avail_type == 'time_range':
        start_time = availability.get('start_time')
        end_time = availability.get('end_time')
        
        if start_time and end_time:
            current_time = now.strftime('%H:%M')
            return start_time <= current_time <= end_time
    
    # Check specific days
    elif avail_type == 'days':
        days = availability.get('days', [])
        current_day = now.strftime('%A').lower()
        
        if current_day in [d.lower() for d in days]:
            # Also check time range if specified
            start_time = availability.get('start_time')
            end_time = availability.get('end_time')
            
            if start_time and end_time:
                current_time = now.strftime('%H:%M')
                return start_time <= current_time <= end_time
            return True
        return False
    
    return False