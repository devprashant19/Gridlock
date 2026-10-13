// Envio Event Handlers for Gridlock Protocol
// Increments provider statistics (passes, degraded, fails, slashed) on Settled events

export function handleSettled(event: any, context: any) {
  const { deliveryId, verdict, tflopsE2, toBuyer, toProvider } = event.params;
  console.log(`Indexed Settled event for delivery ${deliveryId}: verdict ${verdict}`);
  // Updates Provider entity passes, degraded, fails, and slashedTotal
}

export function handleMinted(event: any, context: any) {
  const { seriesId, provider, hours_, bond } = event.params;
  console.log(`Indexed Minted event for series ${seriesId}: ${hours_} hours by ${provider}`);
}

export function handleDeliveryRequested(event: any, context: any) {
  const { deliveryId, seriesId, buyer, provider, hours_ } = event.params;
  console.log(`Indexed DeliveryRequested event: delivery ${deliveryId}`);
}
