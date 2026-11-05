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

  // Scénario officiel : Lot de 10 billets attribués à "Chambre Neuf"
  const chambreNeufTickets: UserTicket[] = Array.from({ length: 10 }, (_, i) => ({
    ...base(i),
    isPhysical: true,
    agentId: 'c9a8b710-0000-4000-8000-000000000002',
    sales_agents: { point_de_vente: 'Chambre Neuf', gerant_name: 'Babacar' },
  }));

  console.log('\n[TEST CHAMBRE NEUF (10 BILLETS)] Vérification du libellé sur les 10 billets :');
  let failures = 0;
  chambreNeufTickets.forEach((t, i) => {
    const label = resolvePointDeVenteLabel(t);
    const ok = label.toUpperCase() === 'CHAMBRE NEUF';
    if (!ok) failures++;
    console.log(`   ${ok ? 'OK ' : 'KO '} billet ${i + 1}/10 -> "${label}" (attendu "Chambre Neuf")`);
  });

  if (failures > 0) throw new Error(`${failures} billets ne portent pas le libellé "Chambre Neuf"`);

  const pdfBlob = await generatePhysicalTicketsPdf(mockEvent, mockTier, chambreNeufTickets, {
    batchName: 'LOT_CHAMBRE_NEUF_10PCS',
    onProgress: (cur, tot) => console.log(`   Progression rendu PDF: billet ${cur}/${tot}`),
  });

  const buffer = Buffer.from(await pdfBlob.arrayBuffer());
  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'Billets_KMOU_JANGO_Chambre_Neuf_10pcs.pdf');
  fs.writeFileSync(outputPath, buffer);

  const raw = buffer.toString('latin1');
  if (raw.includes('Point de Vente Agr')) throw new Error('Le libellé tronqué "Point de Vente Agr" est encore présent.');

  console.log(`\n[TEST CHAMBRE NEUF] SUCCÈS : PDF nominatif de 10 billets généré (${(buffer.length / 1024).toFixed(1)} Ko)`);
  console.log(`   Fichier : ${outputPath}`);
  console.log(`   Nombre de billets Chambre Neuf validés : 10/10`);
}

testPdfGeneration().catch((err) => {
  console.error('[TEST POINT DE VENTE] Erreur:', err);
  process.exit(1);
});
