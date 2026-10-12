/*
 * CoverCarousel — carrousel de photos de couverture pour page publique restaurant.
 *
 * Props :
 *   photos: string[]   (data URLs, 0 à 3 photos)
 *   height: string     (ex: "h-48 md:h-64", défaut "h-52 md:h-72")
 *   fallbackGradient: string (CSS gradient si photos = [])
 *   logo: string       (fallback minimal si aucune photo — affiche logo centré)
 *   brandColor: string
 *   testid: string
 *
 * Comportement :
 *   - Autoplay 5s entre les slides, boucle infinie
 *   - Navigation par dots cliquables (si ≥2 photos)
 *   - Swipe tactile (mobile)
 *   - Si 0 photo → fallback gradient + logo si fourni
 *   - Si 1 photo → statique (pas d'autoplay ni dots)
 *   - Si 2 ou 3 photos → autoplay + dots
 *   - Pause de l'autoplay au survol / touch
 */
import React, { useEffect, useRef, useState } from 'react';

const CoverCarousel = ({
  photos = [],
  height = 'h-52 md:h-72',
  fallbackGradient,
  logo,
  brandColor = '#FF6B00',
  testid = 'cover-carousel',
}) => {
  const cleanPhotos = (photos || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    if (cleanPhotos.length < 2 || paused) return;
    const id = setInterval(() => {
      setIndex(i => (i + 1) % cleanPhotos.length);
    }, 5000);
    return () => clearInterval(id);
  }, [cleanPhotos.length, paused]);

  // Empty state ------------------------------------------------------------
  if (cleanPhotos.length === 0) {
    return (
      <div
        className={`${height} w-full relative overflow-hidden`}
        style={{ background: fallbackGradient || `linear-gradient(135deg, ${brandColor} 0%, #1a1a1a 100%)` }}
        data-testid={`${testid}-empty`}
      >
        {logo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <img src={logo} alt="" className="w-24 h-24 rounded-2xl object-cover" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/25" />
      </div>
    );
  }

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) {
      setIndex(i => (dx < 0
        ? (i + 1) % cleanPhotos.length
        : (i - 1 + cleanPhotos.length) % cleanPhotos.length));
    }
    touchStart.current = null;
  };

  return (
    <div
      className={`${height} w-full relative overflow-hidden`}
      data-testid={testid}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {cleanPhotos.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Cover ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          data-testid={`${testid}-slide-${i}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

      {cleanPhotos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2" data-testid={`${testid}-dots`}>
          {cleanPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              data-testid={`${testid}-dot-${i}`}
              aria-label={`Aller à la photo ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CoverCarousel;
