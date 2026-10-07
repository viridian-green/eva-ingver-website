/* Shop page: shows prices and Buy buttons, then sends the customer to
   Stripe to pay. Everything you edit (prices, delivery fees, labels)
   is in shop.html, not here. */
(() => {
  const shop = document.querySelector(".shop");
  if (!shop) return;
  const select = document.getElementById("destination");

  const currency = shop.dataset.currency || "EUR";
  const money = (n) => new Intl.NumberFormat(document.documentElement.lang || "en", {
    style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

  const error = document.createElement("p");
  error.className = "shop-error";
  error.setAttribute("role", "alert");
  error.textContent = shop.dataset.errorLabel || "";
  error.hidden = true;
  select.closest(".delivery").after(error);

  // Show each region's fee next to its name, and remember the visitor's choice.
  for (const option of select.options) {
    option.textContent = `${option.textContent.trim()} — ${money(Number(option.dataset.fee))}`;
  }
  try {
    const saved = localStorage.getItem("destination");
    if ([...select.options].some((o) => o.value === saved)) select.value = saved;
  } catch {}
  select.addEventListener("change", () => {
    try { localStorage.setItem("destination", select.value); } catch {}
  });

  // Price line and Buy button for each piece.
  for (const item of shop.querySelectorAll(".item")) {
    const price = document.createElement("p");
    price.className = "price";
    item.querySelector("h3").after(price);

    const amount = Number(item.dataset.price);
    if (item.hasAttribute("data-sold") || !(amount > 0)) {
      price.textContent = shop.dataset.soldLabel || "";
      continue;
    }
    price.textContent = money(amount);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "buy";
    button.textContent = shop.dataset.buyLabel || "";
    button.addEventListener("click", () => buy(item, button));
    item.append(button);
  }

  async function buy(item, button) {
    button.disabled = true;
    error.hidden = true;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.querySelector("h3").textContent, destination: select.value }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`);
      location.href = data.url;
    } catch (err) {
      console.error(err);
      error.hidden = false;
      button.disabled = false;
    }
  }

  // Re-enable the buttons if the customer comes back from Stripe with the back button.
  addEventListener("pageshow", () => {
    for (const b of shop.querySelectorAll(".buy")) b.disabled = false;
  });
})();
