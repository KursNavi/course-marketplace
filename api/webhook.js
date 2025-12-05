// api/webhook.js
// This is a "Dummy Listener" to verify the connection with Stripe.
export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log("Stripe knocked on the door!");
    // We just say "OK" for now so Stripe knows we exist.
    res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}