/* Shop pages.
   - shop.html: shows each piece's price; clicking a piece opens its own page.
   - piece.html: one piece with its picture, description, colour choice, delivery and Buy
     button, then sends the customer to Stripe to pay.
   Everything you edit (pieces, prices, colours, delivery fees, labels) is in shop.html, not here. */
(() => {
  const NAME = ".name, h1, h2, h3, h4";  // a piece's name: the line with class="name", or its heading
  const nameOf = (item) => {
    const heading = item.querySelector(NAME);
    return heading ? heading.textContent.replace(/\s+/g, " ").trim() : "";
  };
  const colorsOf = (item) => (item.dataset.colors || "").split(",").map((c) => c.trim()).filter(Boolean);
  const isForSale = (item) => !item.hasAttribute("data-sold") && Number(item.dataset.price) > 0;
  const pieceUrl = (name) => `piece.html?item=${encodeURIComponent(name)}`;
  // Dot colours for the colour switch: the same bright LED colours as the birds' lights.
  // Any other colour name (e.g. "Red") uses the browser's colour of that name.
  const SWATCHES = { green: "#2bff6b", blue: "#2b9bff", purple: "#b74bff" };

  const formatter = (currency) => (n) => new Intl.NumberFormat(document.documentElement.lang || "en", {
    style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

  // The price line under a piece's name (in `into`, the piece itself by default): the price, or "Sold".
  function addPrice(item, shop, money, into = item) {
    const price = document.createElement("p");
    price.className = "price";
    price.textContent = isForSale(item) ? money(Number(item.dataset.price)) : shop.dataset.soldLabel || "";
    const heading = into.querySelector(NAME);
    if (heading) heading.after(price);
    else into.append(price);
  }

  /* ---------- shop.html ---------- */
  const shop = document.querySelector(".shop");
  if (shop) {
    const money = formatter(shop.dataset.currency || "EUR");
    for (const item of shop.querySelectorAll(".item")) {
      addPrice(item, shop, money);
      const name = nameOf(item);
      if (!name) continue;
      // The name becomes a link to the piece's page; clicking anywhere on the piece follows it.
      const heading = item.querySelector(NAME);
      const link = document.createElement("a");
      link.href = pieceUrl(name);
      link.append(...heading.childNodes);
      heading.append(link);
      item.classList.add("item--link");
      item.addEventListener("click", (e) => {
        if (!e.target.closest("a")) location.href = link.href;
      });
    }
  }

  /* ---------- piece.html ---------- */
  const piece = document.querySelector("[data-piece]");
  if (piece) showPiece(piece);

  // Apple-style share button: opens the phone's or computer's share menu (Messages, AirDrop,
  // WhatsApp, Mail…). Where there is no share menu, it copies the link instead.
  const SHARE_ICON = `<svg class="share__icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8.5 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1.5"/>
    <path d="M12 3v12"/><path d="M8.5 6.5 12 3l3.5 3.5"/></svg>`;

  function shareButton(name, source) {
    const label = source.dataset.shareLabel || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "share";
    button.innerHTML = SHARE_ICON;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    button.setAttribute("aria-label", label || "Share");

    button.addEventListener("click", async () => {
      const data = { title: document.title, text: name, url: location.href };
      if (navigator.share) {
        try {
          await navigator.share(data);
          return;
        } catch (err) {
          if (err.name === "AbortError") return;  // the visitor closed the share menu
        }
      }
      try {
        await navigator.clipboard.writeText(location.href);
        text.textContent = source.dataset.copiedLabel || label;
        setTimeout(() => { text.textContent = label; }, 2000);
      } catch (err) {
        console.error("Could not share or copy the link", err);
      }
    });
    return button;
  }

  async function showPiece(container) {
    const wanted = (new URLSearchParams(location.search).get("item") || "").replace(/\s+/g, " ").trim();
    let source, item, deliveryPage;
    try {
      const load = async (url) => new DOMParser().parseFromString(await (await fetch(url)).text(), "text/html");
      const [shopPage, delivery] = await Promise.all([load("shop.html"), load("delivery.html").catch(() => null)]);
      source = shopPage.querySelector(".shop");
      item = source && [...source.querySelectorAll(".item")].find((i) => nameOf(i) === wanted);
      deliveryPage = delivery;
    } catch (err) {
      console.error(err);
    }
    if (!item) {
      document.querySelector("[data-piece-missing]").hidden = false;
      return;
    }

    const money = formatter(source.dataset.currency || "EUR");
    const name = nameOf(item);
    document.title = `${name} — ${document.querySelector(".site-name").textContent.trim()}`;

    // Picture on one side; name, price, description, choices and Buy button on the other.
    const img = item.querySelector("img");
    if (img) {
      img.removeAttribute("loading");
      container.append(img);
    }
    const details = document.createElement("div");
    details.className = "piece-details";
    const heading = document.createElement("h1");
    heading.textContent = name;
    details.append(heading);
    addPrice(item, source, money, details);
    for (const el of [...item.children]) {
      if (!el.matches(`img, ${NAME}`)) details.append(el);  // the description, and anything else in the block
    }
    container.append(details);

    if (!isForSale(item)) {
      details.append(shareButton(name, source));
      return;
    }

    // Colour choice, in the same style as the birds' Lights switch.
    const colors = colorsOf(item);
    let color = colors[0] || null;
    if (colors.length) {
      const box = document.createElement("div");
      box.className = "led-switch led-switch--inline";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", source.dataset.colorLabel || "Colour");
      const label = document.createElement("span");
      label.className = "led-switch__label";
      label.textContent = source.dataset.colorLabel || "";
      box.append(label);
      const buttons = colors.map((c) => {
        const b = document.createElement("button");
        b.type = "button";
        const swatch = document.createElement("span");
        swatch.className = "led-switch__swatch";
        swatch.style.setProperty("--swatch", SWATCHES[c.toLowerCase()] || c.toLowerCase());
        b.append(swatch, c);
        b.addEventListener("click", () => { color = c; update(); });
        box.append(b);
        return [c, b];
      });
      const update = () => { for (const [c, b] of buttons) b.setAttribute("aria-pressed", String(c === color)); };
      update();
      details.append(box);
    }

    // Delivery picker (from delivery.html), with each region's fee shown next to its name.
    const select = (deliveryPage && deliveryPage.querySelector("#destination")) || source.querySelector("#destination");
    if (select) {
      const delivery = select.closest(".delivery").cloneNode(true);
      const picker = delivery.querySelector("select");
      for (const option of picker.options) {
        option.textContent = `${option.textContent.trim()} — ${money(Number(option.dataset.fee))}`;
      }
      try {
        const saved = localStorage.getItem("destination");
        if ([...picker.options].some((o) => o.value === saved)) picker.value = saved;
      } catch {}
      picker.addEventListener("change", () => {
        try { localStorage.setItem("destination", picker.value); } catch {}
      });
      details.append(delivery);
    } else {
      console.error('delivery.html has no <select id="destination">: customers can\'t pay until the delivery regions are back.');
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "buy";
    button.textContent = source.dataset.buyLabel || "";
    const error = document.createElement("p");
    error.className = "shop-error";
    error.setAttribute("role", "alert");
    error.textContent = source.dataset.errorLabel || "";
    error.hidden = true;
    details.append(button, error, shareButton(name, source));

    button.addEventListener("click", async () => {
      button.disabled = true;
      error.hidden = true;
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: name,
            color,
            destination: details.querySelector("#destination") && details.querySelector("#destination").value,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`);
        location.href = data.url;
      } catch (err) {
        console.error(err);
        error.hidden = false;
        button.disabled = false;
      }
    });

    // Re-enable the button if the customer comes back from Stripe with the back button.
    addEventListener("pageshow", () => { button.disabled = false; });
  }
})();
