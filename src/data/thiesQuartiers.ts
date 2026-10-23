export interface ThiesQuartier {
  name: string;
  zone: 'Thiès Nord' | 'Thiès Est' | 'Thiès Ouest';
  description?: string;
}

/**
 * Liste officielle et emblématique des 33 quartiers de la Ville de Thiès (Sénégal)
 * Répartis équitablement sur les 3 communes d'arrondissement :
 * - Thiès Nord (11 quartiers)
 * - Thiès Est (11 quartiers)
 * - Thiès Ouest (11 quartiers)
 */
export const THIES_33_QUARTIERS: ThiesQuartier[] = [
  // --- THIÈS NORD (11 quartiers) ---
  { name: 'Médina Fall', zone: 'Thiès Nord', description: 'Grand quartier historique et pôle culturel' },
  { name: 'Thialy', zone: 'Thiès Nord', description: 'Quartier dynamique et résidentiel' },
  { name: 'Diakhao', zone: 'Thiès Nord', description: 'Secteur traditionnel et commerçant' },
  { name: 'Nguinth', zone: 'Thiès Nord', description: 'Zone verdoyante et résidentielle' },
  { name: 'Escale Nord', zone: 'Thiès Nord', description: 'Prolongement nord du centre-ville' },
  { name: 'Keur Mame El Hadji', zone: 'Thiès Nord', description: 'Quartier spirituel et historique' },
  { name: 'Takhikao', zone: 'Thiès Nord', description: 'Secteur résidentiel et universitaire' },
  { name: 'Kaosara', zone: 'Thiès Nord', description: 'Zone en expansion continue' },
  { name: 'Keur Issa', zone: 'Thiès Nord', description: 'Quartier paisible' },
  { name: 'Keur Modou Ndiaye', zone: 'Thiès Nord', description: 'Secteur péri-urbain' },
  { name: 'Zone ZAC (Nord)', zone: 'Thiès Nord', description: 'Zone d’Aménagement Concerté' },

  // --- THIÈS EST (11 quartiers) ---
  { name: 'Diamaguène', zone: 'Thiès Est', description: 'Quartier central et très commerçant' },
  { name: 'Hersent 1', zone: 'Thiès Est', description: 'Grand carrefour populaire et actif' },
  { name: 'Hersent 2', zone: 'Thiès Est', description: 'Extension résidentielle d’Hersent' },
  { name: 'Cité Lamy', zone: 'Thiès Est', description: 'Quartier cheminot historique' },
  { name: 'Parcelles Assainies', zone: 'Thiès Est', description: 'Zone résidentielle structurée' },
  { name: 'Cité Senghor', zone: 'Thiès Est', description: 'Cité moderne et résidentielle' },
  { name: 'Sampathé', zone: 'Thiès Est', description: 'Secteur réputé de Thiès Est' },
  { name: 'Silmang', zone: 'Thiès Est', description: 'Quartier traditionnel en développement' },
  { name: 'Darou Salam', zone: 'Thiès Est', description: 'Quartier paisible et familial' },
  { name: 'Fahu', zone: 'Thiès Est', description: 'Quartier résidentiel dynamique' },
  { name: 'Ballabey', zone: 'Thiès Est', description: 'Quartier historique des cheminots' },

  // --- THIÈS OUEST (11 quartiers) ---
  { name: 'Escale Sud (Centre-Ville)', zone: 'Thiès Ouest', description: 'Cœur historique, gare ferroviaire et administrations' },
  { name: 'Grand Standing', zone: 'Thiès Ouest', description: 'Quartier haut de gamme et axe Dakar' },
  { name: 'Randoulène Nord', zone: 'Thiès Ouest', description: 'Quartier emblématique et animé' },
  { name: 'Randoulène Sud', zone: 'Thiès Ouest', description: 'Secteur culturel et festif' },
  { name: 'Cité Malick Sy', zone: 'Thiès Ouest', description: 'Cité résidentielle et estudiantine' },
  { name: 'Carrières', zone: 'Thiès Ouest', description: 'Quartier populaire et industrieux' },
  { name: 'HLM Route de Dakar', zone: 'Thiès Ouest', description: 'Zone résidentielle stratégique' },
  { name: 'Mbour 1', zone: 'Thiès Ouest', description: 'Quartier commerçant et animé' },
  { name: 'Mbour 2 & 3', zone: 'Thiès Ouest', description: 'Secteur populaire et actif' },
  { name: '10ème (ex-RIAOM)', zone: 'Thiès Ouest', description: 'Zone militaire et historique' },
  { name: 'Som', zone: 'Thiès Ouest', description: 'Quartier ouest verdoyant' },
];

/**
 * Noms seuls triés par ordre alphabétique
 */
export const THIES_QUARTIER_NAMES = THIES_33_QUARTIERS.map((q) => q.name).sort((a, b) =>
  a.localeCompare(b, 'fr')
);

/**
 * Quartiers groupés par commune d'arrondissement
 */
export const THIES_QUARTIERS_BY_ZONE = {
  'Thiès Ouest': THIES_33_QUARTIERS.filter((q) => q.zone === 'Thiès Ouest'),
  'Thiès Est': THIES_33_QUARTIERS.filter((q) => q.zone === 'Thiès Est'),
  'Thiès Nord': THIES_33_QUARTIERS.filter((q) => q.zone === 'Thiès Nord'),
};
