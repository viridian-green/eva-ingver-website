/* Vercel serverless function: POST /api/checkout
   Creates a Stripe Checkout page for one piece plus a flat delivery fee.
   Stripe collects the customer's email, phone, shipping address and payment.

   Prices and colours are read from this site's own copy of shop.html, and delivery
   regions and fees from delivery.html (both bundled with the function, see vercel.json),
   so those files stay the only place to edit them, and visitors can't change them in the browser.

   Needs the STRIPE_SECRET_KEY environment variable in Vercel. */
const fs = require("fs");
const path = require("path");

// Every country Stripe Checkout can ship to (from Stripe's API specification).
// Used for the "*" (rest of the world) delivery option.
const ALL_COUNTRIES = [
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE",
  "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CD", "CF",
  "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC",
  "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
  "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN",
  "IO", "IQ", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LB",
  "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MK", "ML", "MM", "MN", "MO",
  "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NU",
  "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PY", "QA", "RE", "RO", "RS", "RU",
  "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX",
  "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG",
  "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
];
// Currencies without cents: https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

const attrs = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) out[m[1]] = m[2] ?? "";
  return out;
};
const text = (html) => html
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();

// Reads one of the site's pages, without the instructions in its comments.
const readPage = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8").replace(/<!--[\s\S]*?-->/g, "");

function readShop() {
  const html = readPage("shop.html");

  const shopTag = html.match(/<section[^>]*class="shop"[^>]*>/);
  const settings = attrs(shopTag ? shopTag[0] : "");

  // Each piece runs to its </article>, or (if that was forgotten) to the next piece or the end of the shop.
  const items = [...html.matchAll(/<article([^>]*class="item"[^>]*)>([\s\S]*?)(?=<\/article>|<article|<\/section>|$)/g)].map(([, a, body]) => {
    const at = attrs(a);
    // The piece's name: the element with class="name", or else its heading (whatever its level).
    const name = body.match(/<(\w+)[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/)
      || body.match(/<(h[1-4])[^>]*>([\s\S]*?)<\/h[1-6]>/);
    const img = body.match(/<img[^>]*src="([^"]+)"/);
    return {
      name: name ? text(name[2]) : "",
      price: Number(at["data-price"]),
      sold: "data-sold" in at,
      image: img && img[1],
      colors: (at["data-colors"] || "").split(",").map((c) => c.trim()).filter(Boolean),
    };
  });

  // Delivery regions live in delivery.html (older versions kept them in shop.html).
  let deliveryHtml = "";
  try { deliveryHtml = readPage("delivery.html"); } catch (err) { console.error("Could not read delivery.html", err); }
  const select = deliveryHtml.match(/<select[^>]*id="destination"[^>]*>([\s\S]*?)<\/select>/)
    || html.match(/<select[^>]*id="destination"[^>]*>([\s\S]*?)<\/select>/);
  const destinations = select
    ? [...select[1].matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/g)].map(([, a, label]) => {
        const at = attrs(a);
        return {
          value: at.value,
          label: text(label),
          fee: Number(at["data-fee"]),
          countries: (at["data-countries"] || "").toUpperCase().split(/\s+/).filter(Boolean),
        };
      })
    : [];

  return { currency: (settings["data-currency"] || "EUR").toLowerCase(), items, destinations };
}

// Stripe's API takes form fields like line_items[0][price_data][currency].
function form(obj, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    return res.status(500).json({ error: "Payments are not set up yet" });
  }

  try {
    const shop = readShop();
    const body = req.body || {};
    const wanted = String(body.item || "").replace(/\s+/g, " ").trim();

    const item = shop.items.find((i) => i.name === wanted);
    if (!item || item.sold || !(item.price > 0)) return res.status(400).json({ error: "This piece is not available" });

    // Pieces with colour options need one of their own colours.
    let color = null;
    if (item.colors.length) {
      color = item.colors.find((c) => c === body.color);
      if (!color) return res.status(400).json({ error: "Please choose a colour" });
    }
    const title = color ? `${item.name} — ${color}` : item.name;

    const dest = shop.destinations.find((d) => d.value === body.destination);
    if (!dest || !(dest.fee >= 0)) return res.status(400).json({ error: "Unknown delivery region" });

    // "*" means every country not listed in another region.
    const listedElsewhere = new Set(shop.destinations.filter((d) => d !== dest).flatMap((d) => d.countries));
    const countries = dest.countries.includes("*")
      ? ALL_COUNTRIES.filter((c) => !listedElsewhere.has(c))
      : dest.countries.filter((c) => ALL_COUNTRIES.includes(c));
    if (!countries.length) throw new Error(`No valid countries for delivery region "${dest.value}"`);

    const currency = shop.currency;
    const minor = (amount) => Math.round(amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));
    const origin = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = {
      mode: "payment",
      success_url: `${origin}/thanks.html`,
      cancel_url: `${origin}/shop.html`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: minor(item.price),
          product_data: { name: title, images: item.image ? [new URL(item.image, `${origin}/`).href] : null },
        },
      }],
      shipping_address_collection: { allowed_countries: countries },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: dest.label,
          fixed_amount: { amount: minor(dest.fee), currency },
        },
      }],
      phone_number_collection: { enabled: true },
      // Shown on the payment in the Stripe Dashboard, so you know exactly what to send.
      payment_intent_data: { description: title, metadata: { piece: item.name, color } },
      metadata: { piece: item.name, color },
    };

    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form(session),
    });
    const data = await stripe.json();
    if (!stripe.ok) throw new Error((data.error && data.error.message) || `Stripe responded ${stripe.status}`);
    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkout failed" });
  }
};
