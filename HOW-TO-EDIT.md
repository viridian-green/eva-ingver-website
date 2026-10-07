# How to edit the website

The site is five pages and one style file. Open any of them in a text editor
(TextEdit in "plain text" mode, or a free editor like VS Code), make a change, and save.

```
index.html      Home page (intro text + pictures)
shop.html       Shop page: pieces for sale, prices, colours
delivery.html   Delivery regions and fees
piece.html      One piece's own page (made from shop.html, nothing to edit)
contact.html    Contact page
thanks.html     Page shown after someone pays
styles.css      Colours, font and spacing for every page
images/         All photos (images/birds/ holds the small bird pictures)
js/birds.js     Birds that follow the mouse
js/shop.js      Shows prices and Buy buttons (no need to edit)
api/checkout.js Sends the buyer to Stripe to pay (no need to edit)
```

## Change text
Find the words in the page and type over them. Only change text **between** tags,
e.g. `<p>change this</p>`, not the parts inside `< >`.

## Add a picture (home page)
1. Put the photo in the `images` folder. Use a simple name with no spaces, like `vase-blue.jpg`.
2. In `index.html`, copy one block from `<figure>` to `</figure>` and paste it below the others.
3. Change `src="images/..."` to your file name, and update the `alt` text (a short description) and the caption.

Portrait photos (taller than wide) fit best. Keep photos under about 1 MB. Exporting at 1600 px wide is plenty.

## Add a piece to the shop
In `shop.html`, copy one block from `<article class="item" ...>` to `</article>`, paste it, and change
the picture, name (the line with `class="name"`), description and `data-price="28"` (number only). The price appears by itself.
Each piece needs a different name, and remember the closing `</article>`.
Sold? Replace `data-price="28"` with `data-sold`. The piece will show "Sold" and no Buy button.

Clicking a piece in the shop opens its own page (`piece.html`) with the big picture, description,
colour choice, delivery and the **Buy** button. That page is made from the same block, so there's nothing extra to edit.

**Colour choice:** add `data-colors="Green, Blue, Purple"` to a piece's `<article ...>` line (any names,
separated by commas). The buyer picks one on the piece's page, and the order in Stripe shows it,
e.g. "LED eyelash — Blue". The heading above the colour buttons is `data-color-label` on the shop settings line.

## Delivery fees
Delivery regions and fees are in their own file, `delivery.html`. Each `<option ...>` line is one region with one flat fee:
- `data-fee="12"`: the fee
- `data-countries="FR BE"`: two-letter country codes ([list](https://www.iban.com/country-codes)), or `*` for "every other country"
- the words between the tags: the region's name

Each piece's page shows this picker above the Buy button. When paying, customers can only enter an address in the region they picked.

## Share button
Under the Buy button, each piece's page has a share icon. On phones and Macs it opens the share menu
(Messages, AirDrop, WhatsApp…); elsewhere it copies the link. Its text is `data-share-label` on the
shop settings line in `shop.html` (leave it empty to show only the icon).

## Payments
Payments go through Stripe. The buyer enters their email, phone, delivery address and card on
Stripe's page. Each order appears in the Stripe Dashboard under **Payments**, with the address to post it to.
Turn on email notifications in Stripe so you hear about every sale.

## Things that appear on every page
The studio name, menu and footer are repeated at the top and bottom of each page
(index, shop, piece, contact, thanks). If you change them, change them in all five files.

## Change colours or font
Edit the values at the top of `styles.css`:
`--bg` (background), `--text` (text colour), `--font`, `--size`.

## The birds
The birds follow the mouse, circle it when it stays still, scatter on a click, and after 15 seconds
fly up to rest on the black line under the header. All their settings (size, speed, rest time,
light colours, the Lights switch) are in `birdConfig` at the top of `js/birds.js`.
Pictures are in `images/birds/`: each `birdN.png` has a `birdN-mask.png` (the bird's shape, used
for the light outline and for standing on the line). Keep them small, about 320 px.
The header's top padding in `styles.css` leaves room above the line for the birds. Keep it if you change the header.
To remove the birds, delete the line `<script src="js/birds.js"></script>` near the bottom of each page.

## Preview
Double-click `index.html` to open it in your browser. Refresh after saving a change.
(The Buy buttons only work once the site is online.)

## Put it online
The site is hosted on **Vercel**, because the Buy buttons need its small payment function (`api/`).
Stripe's secret key goes in Vercel → Project → Settings → Environment Variables as `STRIPE_SECRET_KEY`.
After changing any file, redeploy the folder to Vercel.
