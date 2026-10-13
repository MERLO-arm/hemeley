import { useEffect } from 'react';

const DEFAULT_TITLE = 'Hemeley | Street Food, Saveurs & Commande à Table à Douala';
const DEFAULT_DESC = 'Découvrez et commandez la meilleure street food à Douala (Bonapriso, Bonanjo, Akwa). Commande express à table sans contact par QR code ou livraison rapide.';
const DEFAULT_IMAGE = 'https://hemeley.vercel.app/og-image.png';
const BASE_URL = 'https://hemeley.vercel.app';

/**
 * Composant SEO dynamique pour Single Page Application (SPA).
 * Met à jour dynamiquement <title>, <meta description>, canonical, Open Graph et Schema.org.
 */
const SEO = ({
  title,
  description = DEFAULT_DESC,
  path = '',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  structuredData = null,
}) => {
  const fullTitle = title ? `${title} | Hemeley Douala` : DEFAULT_TITLE;
  const canonicalUrl = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  useEffect(() => {
    // 1. Titre de l'onglet
    document.title = fullTitle;

    // Helper pour mettre à jour ou créer une balise meta
    const setMetaTag = (attrName, attrValue, content) => {
      let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attrName, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // 2. Balises SEO standards
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

    // 3. Balise Canonical
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', canonicalUrl);

    // 4. Open Graph (Facebook / WhatsApp / LinkedIn)
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:image', image);

    // 5. Twitter Card
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', image);

    // 6. Schema.org JSON-LD dynamique
    let scriptTag = document.getElementById('dynamic-seo-schema');
    if (structuredData) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'dynamic-seo-schema';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(structuredData);
    } else if (scriptTag) {
      scriptTag.remove();
    }

    return () => {
      // Nettoyage au démontage pour revenir aux valeurs par défaut
      document.title = DEFAULT_TITLE;
      if (scriptTag) {
        scriptTag.remove();
      }
    };
  }, [fullTitle, description, canonicalUrl, image, type, noindex, structuredData]);

  return null;
};

export default SEO;
