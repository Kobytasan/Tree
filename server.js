import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
await mkdir(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "yalynka.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    old_price INTEGER,
    badge TEXT,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery TEXT NOT NULL,
    address TEXT,
    total INTEGER NOT NULL,
    items TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    avatar TEXT NOT NULL,
    phone TEXT NOT NULL
  );
`);

db.prepare("UPDATE products SET old_price = NULL").run();
db.prepare("UPDATE products SET badge = NULL WHERE badge IN ('-19%', '-16%')").run();

const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
if (!productCount) {
  const insert = db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  [
    [1, "Кава в зернах «Арабіка»", "Продукти", 249, null, "Хіт", "☕", "#dbc19b", "100% арабіка середнього обсмаження. 1 кг.", 18],
    [2, "Набір кухонних ножів", "Дом та кухня", 1299, null, null, "🔪", "#b9ced0", "Набір із 5 ножів із нержавіючої сталі.", 8],
    [3, "Рюкзак міський Nordic", "Одяг та аксесуари", 899, null, "Новинка", "🎒", "#9fc08a", "Практичний рюкзак 24 л із USB-виходом.", 14],
    [4, "Набір органічного догляду", "Краса та догляд", 459, null, "Eco", "🧴", "#d4a8a0", "Гель, крем та шампунь для щоденного догляду.", 22],
    [5, "Бездротова навушники AirBeat", "Електроніка", 1799, null, "Топ", "🎧", "#9daed3", "До 30 годин роботи та шумопоглинання.", 11],
    [6, "Термокружка «Ялинка»", "Дом та кухня", 349, null, "Ексклюзив", "☕", "#d4c28f", "Зберігає температуру до 8 годин. 450 мл.", 30],
    [7, "Чоловіча сорочка Oxford", "Одяг та аксесуари", 799, null, null, "👔", "#a8b8c8", "Класична сорочка зі 100% бавовни.", 16],
    [8, "Настільна лампа Halo", "Дом та кухня", 689, null, "Новинка", "💡", "#e1bd83", "Регульована лампа з USB заряджанням.", 9]
  ].forEach(product => insert.run(...product));
}

[
  [9, "Килимок для йоги Comfort", "Спорт та відпочинок", 579, null, "Новинка", "🧘", "#b5c6a2", "Антиковзаючий килимок, 183 × 61 см.", 20],
  [10, "Подарунковий набір «Свято»", "Подарунки", 749, null, "Подарунок", "🎁", "#d8a58f", "Набір солодощів і текстилю в стильній упаковці.", 13],
  [11, "Портативна колонка BeatBox", "Електроніка", 999, null, "Популярне", "🔊", "#99b7c5", "Компактна колонка з Bluetooth, до 12 годин роботи.", 17],
  [12, "Бавовняний плед Nordic", "Дом та кухня", 849, null, "Новинка", "🧶", "#c8b4a0", "М’який плед 150 × 200 см із натуральної бавовни.", 12]
].forEach(product => db.prepare("INSERT OR IGNORE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...product));

if (!db.prepare("SELECT COUNT(*) AS count FROM employees").get().count) {
  [
    [1, "Олена Ялинська", "Директор", "Керівництво", "ОЯ", "+380 44 123 45 01"],
    [2, "Андрій Коваленко", "Заступник директора", "Керівництво", "АК", "+380 44 123 45 02"],
    [3, "Марія Бондар", "Менеджер магазину", "Продажі", "МБ", "+380 44 123 45 03"],
    [4, "Ігор Петренко", "Адміністратор", "Сервіс та доставка", "ІП", "+380 44 123 45 04"]
  ].forEach(employee => db.prepare("INSERT INTO employees VALUES (?, ?, ?, ?, ?, ?)").run(...employee));
}

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

function send(res, status, data, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.includes("json") ? JSON.stringify(data) : data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1e6) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON")); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/products" && req.method === "GET") {
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const products = category && category !== "Усі товари"
      ? db.prepare("SELECT * FROM products WHERE category = ? ORDER BY id").all(category)
      : db.prepare("SELECT * FROM products ORDER BY id").all();
    return send(res, 200, search
      ? products.filter(p => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search))
      : products);
  }

  if (url.pathname === "/api/categories" && req.method === "GET") {
    return send(res, 200, db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all().map(row => row.category));
  }

  if (url.pathname === "/api/employees" && req.method === "GET") {
    return send(res, 200, db.prepare("SELECT * FROM employees ORDER BY id").all());
  }

  if (url.pathname === "/api/orders" && req.method === "POST") {
    try {
      const order = await readJson(req);
      if (!order.name?.trim() || !/^\+?\d[\d ()-]{7,}$/.test(order.phone || "") || !Array.isArray(order.items) || !order.items.length) {
        return send(res, 400, { error: "Перевірте контактні дані та кошик." });
      }
      const ids = order.items.map(item => item.id);
      const placeholders = ids.map(() => "?").join(",");
      const products = db.prepare(`SELECT id, price FROM products WHERE id IN (${placeholders})`).all(...ids);
      const priceById = new Map(products.map(product => [product.id, product.price]));
      const total = order.items.reduce((sum, item) => sum + (priceById.get(item.id) || 0) * item.qty, 0);
      const result = db.prepare("INSERT INTO orders (customer_name, phone, delivery, address, total, items) VALUES (?, ?, ?, ?, ?, ?)")
        .run(order.name.trim(), order.phone.trim(), order.delivery || "Самовивіз", order.address?.trim() || "", total, JSON.stringify(order.items));
      return send(res, 201, { number: `YL-${String(result.lastInsertRowid).padStart(5, "0")}`, total });
    } catch (error) {
      return send(res, 400, { error: error.message === "Invalid JSON" ? error.message : "Не вдалося оформити замовлення." });
    }
  }

  if (url.pathname === "/api/health") return send(res, 200, { status: "ok" });

  let filePath = path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (!filePath.startsWith(publicDir)) return send(res, 403, { error: "Forbidden" });
  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    send(res, 404, { error: "Not found" });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => console.log(`Ялинка запущена: http://localhost:${port}`));
