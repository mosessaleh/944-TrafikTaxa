"use client";
import { useEffect, useRef, useState } from 'react';

interface TripMapProps {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  className?: string;
}

export default function TripMap({ startLat, startLon, endLat, endLon, className = '' }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const createMapVisualization = async () => {
      if (!mapRef.current) return;

      try {
        setLoading(true);

        // Create map container with realistic map styling
        const mapContainer = document.createElement('div');
        mapContainer.style.width = '100%';
        mapContainer.style.height = '192px';
        mapContainer.style.backgroundColor = '#f0f9ff';
        mapContainer.style.border = '1px solid #e2e8f0';
        mapContainer.style.borderRadius = '8px';
        mapContainer.style.position = 'relative';
        mapContainer.style.overflow = 'hidden';

        // Add realistic map background with streets and areas
        mapContainer.style.backgroundImage = `
          /* Water areas */
          radial-gradient(ellipse at 70% 30%, #dbeafe 40px, transparent 40px),
          radial-gradient(ellipse at 20% 80%, #dbeafe 30px, transparent 30px),

          /* Parks/Green areas */
          radial-gradient(ellipse at 40% 60%, #dcfce7 25px, transparent 25px),
          radial-gradient(ellipse at 80% 70%, #dcfce7 20px, transparent 20px),

          /* Street grid pattern */
          linear-gradient(0deg, #e5e7eb 1px, transparent 1px),
          linear-gradient(90deg, #e5e7eb 1px, transparent 1px),

          /* Building blocks */
          radial-gradient(circle at 15% 20%, #f3f4f6 15px, transparent 15px),
          radial-gradient(circle at 35% 15%, #f3f4f6 12px, transparent 12px),
          radial-gradient(circle at 60% 25%, #f3f4f6 18px, transparent 18px),
          radial-gradient(circle at 85% 35%, #f3f4f6 14px, transparent 14px),
          radial-gradient(circle at 25% 45%, #f3f4f6 16px, transparent 16px),
          radial-gradient(circle at 50% 50%, #f3f4f6 13px, transparent 13px),
          radial-gradient(circle at 75% 55%, #f3f4f6 17px, transparent 17px),
          radial-gradient(circle at 10% 70%, #f3f4f6 11px, transparent 11px),
          radial-gradient(circle at 45% 75%, #f3f4f6 15px, transparent 15px),
          radial-gradient(circle at 90% 80%, #f3f4f6 19px, transparent 19px)
        `;
        mapContainer.style.backgroundSize = '60px 60px, 40px 40px, 30px 30px, 25px 25px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px, 20px 20px';

        // Add route line connecting start to end
        const routeLine = document.createElement('div');
        routeLine.style.position = 'absolute';
        routeLine.style.width = '70%';
        routeLine.style.height = '4px';
        routeLine.style.backgroundColor = '#3b82f6';
        routeLine.style.borderRadius = '2px';
        routeLine.style.transform = 'rotate(45deg)';
        routeLine.style.top = '50%';
        routeLine.style.left = '15%';
        routeLine.style.transformOrigin = 'center';
        routeLine.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
        mapContainer.appendChild(routeLine);

        // Add start marker (green)
        const startMarker = document.createElement('div');
        startMarker.style.position = 'absolute';
        startMarker.style.width = '20px';
        startMarker.style.height = '20px';
        startMarker.style.backgroundColor = '#10b981';
        startMarker.style.border = '3px solid white';
        startMarker.style.borderRadius = '50%';
        startMarker.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        startMarker.style.top = '20%';
        startMarker.style.left = '15%';
        startMarker.style.transform = 'translate(-50%, -50%)';
        startMarker.style.zIndex = '10';
        mapContainer.appendChild(startMarker);

        // Add end marker (red)
        const endMarker = document.createElement('div');
        endMarker.style.position = 'absolute';
        endMarker.style.width = '20px';
        endMarker.style.height = '20px';
        endMarker.style.backgroundColor = '#ef4444';
        endMarker.style.border = '3px solid white';
        endMarker.style.borderRadius = '50%';
        endMarker.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        endMarker.style.top = '80%';
        endMarker.style.left = '85%';
        endMarker.style.transform = 'translate(-50%, -50%)';
        endMarker.style.zIndex = '10';
        mapContainer.appendChild(endMarker);

        // Add road/path indicators
        const road1 = document.createElement('div');
        road1.style.position = 'absolute';
        road1.style.width = '80%';
        road1.style.height = '2px';
        road1.style.backgroundColor = '#e5e7eb';
        road1.style.top = '35%';
        road1.style.left = '10%';
        mapContainer.appendChild(road1);

        const road2 = document.createElement('div');
        road2.style.position = 'absolute';
        road2.style.width = '60%';
        road2.style.height = '2px';
        road2.style.backgroundColor = '#e5e7eb';
        road2.style.top = '65%';
        road2.style.left = '20%';
        road2.style.transform = 'rotate(-15deg)';
        road2.style.transformOrigin = 'left center';
        mapContainer.appendChild(road2);

        // Clear and add
        mapRef.current.innerHTML = '';
        mapRef.current.appendChild(mapContainer);

        // Try to get route distance
        try {
          const response = await fetch(`/api/route?startLat=${startLat}&startLon=${startLon}&endLat=${endLat}&endLon=${endLon}`);
          const data = await response.json();
          if (data.ok && data.route) {
            setRoute(data.route);
          }
        } catch (routeError) {
          console.warn('Failed to load route distance:', routeError);
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to create map:', error);
        setLoading(false);
      }
    };

    createMapVisualization();
  }, [startLat, startLon, endLat, endLon]);

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-600 border-t-transparent"></div>
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-lg border border-slate-200"
        style={{ minHeight: '192px' }}
      />
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Pickup</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Dropoff</span>
        </div>
        {route && route.distance > 0 && (
          <div className="text-slate-500">
            ~{(route.distance / 1000).toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
}