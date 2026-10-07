# How to edit the website

The site is four pages and one style file. Open any of them in a text editor
(TextEdit in "plain text" mode, or a free editor like VS Code), make a change, and save.

```
index.html      Home page (intro text + pictures)
shop.html       Shop page: pieces for sale, prices, delivery fees
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
the picture, name, description and `data-price="28"` (number only). The price and **Buy** button
appear by themselves. Each piece needs a different name.
Sold? Replace `data-price="28"` with `data-sold`. The piece will show "Sold" and no Buy button.

## Delivery fees
In `shop.html`, under "DELIVERY", each `<option ...>` line is one region with one flat fee:
- `data-fee="12"`: the fee
- `data-countries="FR BE"`: two-letter country codes ([list](https://www.iban.com/country-codes)), or `*` for "every other country"
- the words between the tags: the region's name

When paying, customers can only enter an address in the region they picked.

## Payments
Payments go through Stripe. The buyer enters their email, phone, delivery address and card on
Stripe's page. Each order appears in the Stripe Dashboard under **Payments**, with the address to post it to.
Turn on email notifications in Stripe so you hear about every sale.

## Things that appear on every page
The studio name, menu and footer are repeated at the top and bottom of each page
(index, shop, contact, thanks). If you change them, change them in all four files.

## Change colours or font
Edit the values at the top of `styles.css`:
`--bg` (background), `--text` (text colour), `--font`, `--size`.

## The birds
Change their size and speed at the top of `js/birds.js`. To change the pictures, replace the files in
`images/birds/` (keep them small: about 200 px). To remove the birds, delete the line
`<script src="js/birds.js"></script>` near the bottom of each page.

## Preview
Double-click `index.html` to open it in your browser. Refresh after saving a change.
(The Buy buttons only work once the site is online.)

## Put it online
The site is hosted on **Vercel**, because the Buy buttons need its small payment function (`api/`).
Stripe's secret key goes in Vercel → Project → Settings → Environment Variables as `STRIPE_SECRET_KEY`.
After changing any file, redeploy the folder to Vercel.
