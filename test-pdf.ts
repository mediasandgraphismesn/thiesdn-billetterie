import fs from 'fs';
import path from 'path';
import { generatePhysicalTicketsPdf } from './src/services/pdfTicketGenerator';
import { EventItem, TicketTier, UserTicket } from './src/types';

async function testPdfGeneration() {
  console.log('[TÂCHE 2] Démarrage génération du PDF de billets physiques KMOU JANGO...');

  const mockEvent: EventItem = {
    id: 'kmou-jango-2026',
    title: 'KMOU JANGO — Nuit Mythique',
    category: 'Concert & Festival',
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
  };

  const mockTier: TicketTier = {
    id: 'tier-vip-kmou',
    name: 'Pass VIP Prestige',
    price: 10000,
    available: 150,
    total: 200,
    description: 'Accès lounge exclusif, place assise réservée, coupe de bienvenue.',
  };

  const mockTickets: UserTicket[] = Array.from({ length: 5 }).map((_, i) => ({
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
    holderName: `Collaborateur ${i + 1}`,
    status: 'valid' as const,
    purchasedAt: new Date().toISOString(),
    agentName: `Agence Thiès Centre — Guichet ${i + 1}`,
  }));

  console.log(`[TÂCHE 2] Génération de la planche pour ${mockTickets.length} billets...`);
  const pdfBlob = await generatePhysicalTicketsPdf(mockEvent, mockTier, mockTickets, {
    batchName: 'PLANCHE_OFFICIELLE_KMOU_JANGO',
    onProgress: (cur, tot) => console.log(`   Progression: billet ${cur}/${tot}`),
  });

  const arrayBuffer = await pdfBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const outputPath = path.join(process.cwd(), 'test-results', 'PREUVE_BILLETS_PHYSIQUES.pdf');
  fs.writeFileSync(outputPath, buffer);

  console.log(`[TÂCHE 2] SUCCÈS : Fichier PDF généré avec succès (${(buffer.length / 1024).toFixed(1)} Ko) !`);
  console.log(`   Chemin: ${outputPath}`);
}

testPdfGeneration().catch((err) => {
  console.error('[TÂCHE 2] Erreur génération PDF:', err);
  process.exit(1);
});
