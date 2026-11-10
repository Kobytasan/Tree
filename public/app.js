const productGrid = document.getElementById("productGrid");
const filters = document.getElementById("filters");
const cartButton = document.getElementById("cartButton");
const cartPanel = document.getElementById("cartPanel");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const checkoutDialog = document.getElementById("checkoutDialog");
const toast = document.getElementById("toast");

let products = [];
let cart = JSON.parse(localStorage.getItem("yalynka-cart") || "[]");
let activeCategory = new URLSearchParams(location.search).get("category") || "Усі товари";

function formatPrice(value) {
  return new Intl.NumberFormat("uk-UA").format(value) + " грн";
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function loadProducts() {
  const response = await fetch("/api/products");
  products = await response.json();
  const categoriesResponse = await fetch("/api/categories");
  const categories = await categoriesResponse.json();
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has("q")) document.getElementById("searchInput").value = searchParams.get("q");
  filters.innerHTML = ["Усі товари", ...categories].map(category =>
    `<button class="${category === activeCategory ? "active" : ""}" data-category="${category}">${category}</button>`
  ).join("");
  renderProducts();
}

function renderProducts() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const visible = products.filter(product =>
    (activeCategory === "Усі товари" || product.category === activeCategory) &&
    `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(search)
  );
  document.getElementById("catalogCount").textContent = `${visible.length} ${visible.length === 1 ? "товар" : "товарів"}`;
  productGrid.innerHTML = visible.length ? visible.map(product => `
    <article class="product-card">
      <div class="product-image" style="--card-color:${product.color}">
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
        <span class="product-emoji">${product.emoji}</span>
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3>${product.name}</h3>
        <div class="product-bottom">
          <div class="price"><strong>${formatPrice(product.price)}</strong></div>
          ${cart.find(item => item.id === product.id) ? `
            <div class="product-qty" aria-label="Кількість товару">
              <button data-card-qty="-1" data-id="${product.id}" aria-label="Зменшити">−</button>
              <strong>${cart.find(item => item.id === product.id).qty}</strong>
              <button data-card-qty="1" data-id="${product.id}" aria-label="Збільшити">+</button>
            </div>` : `
            <button class="add-button" data-add="${product.id}" aria-label="Додати ${product.name} до кошика">+</button>`}
        </div>
      </div>
    </article>
  `).join("") : `<div class="loader">За вашим запитом нічого не знайдено.</div>`;
}

function saveCart() {
  localStorage.setItem("yalynka-cart", JSON.stringify(cart));
  renderCart();
  if (typeof productGrid !== "undefined" && productGrid) renderProducts();
}

function addToCart(id) {
  const item = cart.find(entry => entry.id === id);
  if (item) item.qty += 1;
  else cart.push({ id, qty: 1 });
  saveCart();
  showToast("Товар додано до кошика");
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    const product = products.find(entry => entry.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
}

function renderCart() {
  const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartCount").textContent = quantity;
  document.getElementById("cartTitle").textContent = `${quantity} ${quantity === 1 ? "товар" : "товарів"}`;
  document.getElementById("cartTotal").textContent = formatPrice(cartTotal());
  document.getElementById("checkoutTotal").textContent = formatPrice(cartTotal());

  cartItems.innerHTML = cart.length ? cart.map(item => {
    const product = products.find(entry => entry.id === item.id);
    if (!product) return "";
    return `
      <div class="cart-item">
        <div class="cart-thumb" style="--thumb-color:${product.color}">${product.emoji}</div>
        <div>
          <h4>${product.name}</h4>
          <div class="qty">
            <button data-qty="-1" data-id="${product.id}" aria-label="Зменшити">−</button>
            <input class="cart-qty-input" type="number" min="1" max="99" value="${item.qty}" data-qty-input="${product.id}" aria-label="Кількість">
            <button data-qty="1" data-id="${product.id}" aria-label="Збільшити">+</button>
          </div>
        </div>
        <span class="cart-item-price">${formatPrice(product.price * item.qty)}</span>
      </div>`;
  }).join("") + `<button class="clear-cart-button" id="clearCartButton">Очистити кошик</button>` : `<p class="empty-cart">Ваш кошик порожній.<br>Час обрати щось гарне!</p>`;
}

function setCart(open) {
  cartPanel.classList.toggle("open", open);
  overlay.classList.toggle("show", open);
  cartPanel.setAttribute("aria-hidden", String(!open));
}

const homeSearchInput = document.getElementById("searchInput");
if (homeSearchInput && !productGrid) {
  homeSearchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    location.href = `/catalog.html?q=${encodeURIComponent(homeSearchInput.value.trim())}`;
  });
}

if (filters && productGrid) {
filters.addEventListener("click", event => {
  if (!event.target.matches("[data-category]")) return;
  activeCategory = event.target.dataset.category;
  filters.querySelectorAll("button").forEach(button => button.classList.toggle("active", button === event.target));
  renderProducts();
});
productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(Number(button.dataset.add));
  const quantityButton = event.target.closest("[data-card-qty]");
  if (quantityButton) {
    const item = cart.find(entry => entry.id === Number(quantityButton.dataset.id));
    if (!item) return;
    item.qty += Number(quantityButton.dataset.cardQty);
    if (item.qty <= 0) cart = cart.filter(entry => entry.id !== item.id);
    saveCart();
  }
});
document.getElementById("searchInput").addEventListener("input", renderProducts);
cartButton.addEventListener("click", () => setCart(true));
document.getElementById("closeCart").addEventListener("click", () => setCart(false));
overlay.addEventListener("click", () => setCart(false));
cartItems.addEventListener("click", event => {
  const button = event.target.closest("[data-qty]");
  if (!button) return;
  const item = cart.find(entry => entry.id === Number(button.dataset.id));
  if (!item) return;
  item.qty += Number(button.dataset.qty);
  if (item.qty <= 0) cart = cart.filter(entry => entry.id !== item.id);
  saveCart();
});
cartItems.addEventListener("change", event => {
  const input = event.target.closest("[data-qty-input]");
  if (!input) return;
  const item = cart.find(entry => entry.id === Number(input.dataset.qtyInput));
  if (!item) return;
  const quantity = Math.max(1, Math.min(99, Number.parseInt(input.value, 10) || 1));
  item.qty = quantity;
  saveCart();
});
cartItems.addEventListener("click", event => {
  if (!event.target.closest("#clearCartButton")) return;
  cart = [];
  saveCart();
  showToast("Кошик очищено");
});
document.querySelectorAll("[data-scroll]").forEach(button => button.addEventListener("click", () => {
  document.getElementById(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
}));
document.getElementById("checkoutButton").addEventListener("click", () => {
  if (!cart.length) return showToast("Кошик порожній");
  setCart(false);
  checkoutDialog.showModal();
});
document.querySelector(".dialog-close").addEventListener("click", () => checkoutDialog.close());
document.getElementById("checkoutForm").onsubmit = async event => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  submit.textContent = "Оформлюємо…";
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, items: cart })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Помилка оформлення");
    checkoutDialog.close();
    cart = [];
    saveCart();
    event.currentTarget.reset();
    showToast(`Замовлення ${result.number} успішно оформлено`);
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Підтвердити замовлення";
  }
};

loadProducts().then(renderCart).catch(() => {
  productGrid.innerHTML = `<div class="loader">Не вдалося завантажити каталог. Перезавантажте сторінку.</div>`;
});
}
