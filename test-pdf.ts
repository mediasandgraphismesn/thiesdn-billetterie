import fs from 'fs';
import path from 'path';
import { generatePhysicalTicketsPdf, resolvePointDeVenteLabel } from './src/services/pdfTicketGenerator';
import { EventItem, TicketTier, UserTicket } from './src/types';

async function testPdfGeneration() {
  console.log('[TEST POINT DE VENTE] Génération du PDF de billets physiques KMOU JANGO...');

  const mockEvent: EventItem = {
    id: 'kmou-jango-2026',
    title: 'KMOU JANGO — Nuit Mythique',
    category: 'Concert',
    date: 'Samedi 07 Novembre 2026',
    time: '21h00 - 05h00',
    venue: 'Stade Lat Dior & Complexe Prestige',
    city: 'Thiès',
    quartier: 'Médina Fall',
    price: 10000,
    priceLabel: '10 000 FCFA',
    posterUrl: '/poster-kmou-jango.jpg',
    description: 'La plus grande soirée culturelle et nocturne de la région de Thiès.',
    promoter: {
      id: 'promoter-1',
      name: 'Thiès Nights Production',
      role: 'Organisateur Officiel',
      avatar: '/logo-tight.png',
      verified: true,
    },
    status: 'approved',
    featured: true,
    vipAvailable: true,
    capacity: 2500,
    soldCount: 1450,
  } as unknown as EventItem;

  const mockTier: TicketTier = {
    id: 'tier-vip-kmou',
    name: 'Pass VIP Prestige',
    price: 10000,
    available: 150,
    perks: [],
    description: 'Accès lounge exclusif, place assise réservée, coupe de bienvenue.',
  };

  const base = (i: number): UserTicket => ({
    id: `kmou-tkt-physique-${1001 + i}`,
    eventId: mockEvent.id,
    eventTitle: mockEvent.title,
    eventDate: mockEvent.date,
    eventTime: mockEvent.time,
    eventVenue: mockEvent.venue,
    eventPoster: mockEvent.posterUrl,
    tierName: mockTier.name,
    price: mockTier.price,
    qrCode: `THIESDN-KMOU-VIP-${1001 + i}`,
    holderName: `Client ${i + 1}`,
    status: 'sold_valid',
    purchasedAt: new Date().toISOString(),
    serialNumber: i + 1,
  });

  // Les 4 cas de test : 3 billets physiques assignés (dont "Chambre Neuf") + 1 billet web sans agent_id
  const mockTickets: UserTicket[] = [
    {
      ...base(0),
      isPhysical: true,
      agentId: '11111111-1111-4111-8111-111111111111',
      sales_agents: { point_de_vente: 'DJ CRAZY', gerant_name: 'Crazy' },
    },
    {
      ...base(1),
      isPhysical: true,
      agentId: '22222222-2222-4222-8222-222222222222',
      sales_agents: { point_de_vente: 'STUDIOS CHAMBRE 9', gerant_name: 'Gérant Studio' },
    },
    {
      ...base(2),
      isPhysical: true,
      agentId: '33333333-3333-4333-8333-333333333333',
      sales_agents: { point_de_vente: 'Chambre Neuf', gerant_name: 'Babacar' },
    },
    {
      ...base(3),
      isPhysical: false,
      sales_agents: null,
    },
  ];

  const expected = ['DJ CRAZY', 'STUDIOS CHAMBRE 9', 'Chambre Neuf', 'Vente en Ligne'];
  let failures = 0;
  mockTickets.forEach((t, i) => {
    const label = resolvePointDeVenteLabel(t);
    const ok = label === expected[i];
    if (!ok) failures++;
    console.log(`   ${ok ? 'OK ' : 'KO '} billet ${i + 1} -> "${label}" (attendu "${expected[i]}")`);
  });
  // Fallback : billet physique avec agent mais sans nom -> "Point de Vente"
  const fallback = resolvePointDeVenteLabel({ ...base(4), isPhysical: true, agentId: 'x', sales_agents: { point_de_vente: '' } });
  console.log(`   ${fallback === 'Point de Vente' ? 'OK ' : 'KO '} fallback -> "${fallback}"`);
  if (fallback !== 'Point de Vente') failures++;
  if (failures > 0) throw new Error(`${failures} cas de test en échec`);

  const pdfBlob = await generatePhysicalTicketsPdf(mockEvent, mockTier, mockTickets, {
    batchName: 'PLANCHE_TEST_POINT_DE_VENTE',
    onProgress: (cur, tot) => console.log(`   Progression: billet ${cur}/${tot}`),
  });

  const buffer = Buffer.from(await pdfBlob.arrayBuffer());
  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'PREUVE_BILLETS_PHYSIQUES.pdf');
  fs.writeFileSync(outputPath, buffer);

  const raw = buffer.toString('latin1');
  if (raw.includes('Point de Vente Agr')) throw new Error('Le libellé tronqué "Point de Vente Agr" est encore présent.');

  console.log(`[TEST POINT DE VENTE] SUCCÈS : PDF généré (${(buffer.length / 1024).toFixed(1)} Ko)`);
  console.log(`   Chemin: ${outputPath}`);
}

testPdfGeneration().catch((err) => {
  console.error('[TEST POINT DE VENTE] Erreur:', err);
  process.exit(1);
});
