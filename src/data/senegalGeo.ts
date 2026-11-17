export type LatLngTuple = [number, number];

/**
 * Centre géographique par défaut : Sénégal (vue nationale)
 */
export const SENEGAL_CENTER: LatLngTuple = [14.55, -15.65];
export const SENEGAL_DEFAULT_ZOOM = 7;

/**
 * Coordonnées GPS des principales villes du Sénégal
 */
export const SENEGAL_CITY_COORDS: Record<string, LatLngTuple> = {
  thies: [14.791, -16.9359],
  dakar: [14.6928, -17.4467],
  mbour: [14.422, -16.9638],
  saly: [14.4433, -17.0278],
  'saint-louis': [16.0179, -16.4896],
  touba: [14.85, -15.8833],
  kaolack: [14.1519, -16.0726],
  ziguinchor: [12.5681, -16.2719],
  tivaouane: [14.95, -16.8167],
  louga: [15.6167, -16.2167],
  diourbel: [14.655, -16.2314],
  tambacounda: [13.7707, -13.6673],
  kolda: [12.8833, -14.95],
  matam: [15.6559, -13.2554],
  kedougou: [12.5579, -12.1743],
  fatick: [14.339, -16.4111],
  sedhiou: [12.7081, -15.5569],
  kaffrine: [14.1059, -15.5508],
  rufisque: [14.7167, -17.2667],
  pikine: [14.7645, -17.3907],
  guediawaye: [14.7756, -17.3958],
  diamniadio: [14.7219, -17.1856],
};

/**
 * Coordonnées GPS des 33 quartiers officiels de Thiès
 */
export const THIES_QUARTIER_COORDS: Record<string, LatLngTuple> = {
  'medina fall': [14.8082, -16.9255],
  thialy: [14.8005, -16.9332],
  diakhao: [14.7985, -16.9421],
  nguinth: [14.8068, -16.9154],
  'escale nord': [14.7955, -16.9288],
  'keur mame el hadji': [14.8124, -16.9395],
  takhikao: [14.8165, -16.9218],
  kaosara: [14.8205, -16.9312],
  'keur issa': [14.8261, -16.9175],
  'keur modou ndiaye': [14.8289, -16.9401],
  'zone zac (nord)': [14.8142, -16.9095],
  diamaguene: [14.7872, -16.9165],
  'hersent 1': [14.7845, -16.9235],
  'hersent 2': [14.7812, -16.9182],
  'cite lamy': [14.7918, -16.9128],
  'parcelles assainies': [14.7755, -16.9102],
  'cite senghor': [14.7788, -16.9268],
  sampathe: [14.7725, -16.9195],
  silmang: [14.7695, -16.9065],
  'darou salam': [14.7865, -16.9052],
  fahu: [14.7945, -16.9045],
  ballabey: [14.7885, -16.9318],
  'escale sud (centre-ville)': [14.7905, -16.9285],
  escale: [14.7912, -16.9285],
  'grand standing': [14.7842, -16.9435],
  'randoulene nord': [14.7948, -16.9402],
  'randoulene sud': [14.7878, -16.9395],
  randoulene: [14.7915, -16.9398],
  'cite malick sy': [14.7775, -16.9388],
  carrieres: [14.7818, -16.9502],
  'hlm route de dakar': [14.7768, -16.9482],
  'mbour 1': [14.7785, -16.9325],
  'mbour 2 & 3': [14.7712, -16.9355],
  '10eme (ex-riaom)': [14.7885, -16.9522],
  som: [14.7955, -16.9535],
};

/**
 * Coordonnées pour les connexions internationales fréquentes (pour visualisation cyber-sécurité)
 */
const INTERNATIONAL_CITY_COORDS: Record<string, LatLngTuple> = {
  paris: [15.45, -17.95], // Affichées en bordure maritime avec libellé explicite si hors Sénégal
  france: [15.45, -17.95],
  london: [15.65, -17.85],
  'new york': [15.25, -18.05],
  'united states': [15.25, -18.05],
  'etats-unis': [15.25, -18.05],
  abidjan: [13.2, -16.95],
  casablanca: [15.85, -17.45],
};

export const normalizeGeoText = (value?: string | null): string => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

export const resolveCityCoordinates = (
  city?: string | null,
  country?: string | null
): { coords: LatLngTuple; label: string; isInternational: boolean } => {
  const normCity = normalizeGeoText(city);
  const normCountry = normalizeGeoText(country);

  if (normCity) {
    for (const [key, coords] of Object.entries(SENEGAL_CITY_COORDS)) {
      if (normCity === key || normCity.includes(key)) {
        return {
          coords,
          label: city?.trim() || key,
          isInternational: false,
        };
      }
    }
  }

  if (normCountry && !normCountry.includes('senegal')) {
    for (const [key, coords] of Object.entries(INTERNATIONAL_CITY_COORDS)) {
      if (normCity.includes(key) || normCountry.includes(key)) {
        return {
          coords,
          label: `${city || country || 'Externe'}`,
          isInternational: true,
        };
      }
    }
    return {
      coords: [15.35, -17.95],
      label: `${city ? `${city}, ` : ''}${country || 'International'}`,
      isInternational: true,
    };
  }

  return {
    coords: SENEGAL_CITY_COORDS.thies,
    label: city?.trim() || 'Thiès',
    isInternational: false,
  };
};

/**
 * Résout une position GPS précise à partir des champs disponibles (GPS explicite > Quartier > Ville)
 * avec léger décalage radial déterministe pour éviter la superposition de marqueurs identiques.
 */
export const resolveSenegalCoordinates = (
  params: {
    latitude?: number | null;
    longitude?: number | null;
    quartier?: string | null;
    adresse?: string | null;
    city?: string | null;
    country?: string | null;
  },
  indexOffset: number = 0,
  spreadRadius: number = 0.0045
): LatLngTuple => {
  if (
    typeof params.latitude === 'number' &&
    typeof params.longitude === 'number' &&
    !Number.isNaN(params.latitude) &&
    !Number.isNaN(params.longitude) &&
    params.latitude !== 0 &&
    params.longitude !== 0
  ) {
    return [params.latitude, params.longitude];
  }

  let base: LatLngTuple | null = null;
  const normQuartier = normalizeGeoText(params.quartier || params.adresse);

  if (normQuartier) {
    for (const [key, coords] of Object.entries(THIES_QUARTIER_COORDS)) {
      if (normQuartier === key || normQuartier.includes(key) || key.includes(normQuartier)) {
        base = coords;
        break;
      }
    }
  }

  if (!base) {
    base = resolveCityCoordinates(params.city, params.country).coords;
  }

  if (indexOffset <= 0) {
    return base;
  }

  const angle = indexOffset * 1.45;
  const radius = spreadRadius * Math.sqrt(indexOffset);
  return [base[0] + radius * Math.cos(angle), base[1] + radius * Math.sin(angle)];
};
