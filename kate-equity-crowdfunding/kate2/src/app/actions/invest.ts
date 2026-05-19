'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function processInvestment(offerId: string, amount: number) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user) {
    throw new Error('Não autorizado. Faça login para investir.');
  }

  // 1. Get the offer
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error('Oferta não encontrada');
  }

  // 2. Get the authenticated user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // 3. Create Reservation
  const reservation = await prisma.reservation.create({
    data: {
      offer_id: offerId,
      investor_id: user.id,
      amount_brz: amount,
      token_quantity: amount / (offer.unit_price || 1), // Simplification
      unit_price: offer.unit_price,
      status: 'pending'
    }
  });

  // 4. Simulate Stellar Blockchain Transaction
  // We'll delay slightly to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

  // 5. Confirm Reservation and create Investor Position
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: 'confirmed',
      confirmed_at: new Date(),
      blockchain_tx_hash: mockTxHash
    }
  });

  // We should also look for a token asset to link to the position
  let tokenAsset = await prisma.tokenAsset.findFirst({
    where: { offer_id: offerId }
  });

  if (!tokenAsset) {
    tokenAsset = await prisma.tokenAsset.create({
      data: {
        issuer_id: offer.issuer_id,
        offer_id: offerId,
        token_symbol: `TKN-${offer.id.substring(0,4).toUpperCase()}`,
        token_name: `Token ${offer.title}`,
        status: 'active'
      }
    });
  }

  await prisma.investorPosition.create({
    data: {
      user_id: user.id,
      issuer_id: offer.issuer_id,
      offer_id: offerId,
      token_asset_id: tokenAsset.id,
      quantity: reservation.token_quantity,
      average_price: offer.unit_price,
      acquisition_origin: 'primary'
    }
  });

  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}/invest/success?tx=${mockTxHash}`);
}
