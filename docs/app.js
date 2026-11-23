const STORAGE_KEY = "wiki-gacha-collection-v1";
const drawButton = document.getElementById("draw-button");
const clearButton = document.getElementById("clear-button");
const resultsElement = document.getElementById("results");
const collectionElement = document.getElementById("collection");
const resultCountElement = document.getElementById("result-count");
const collectionCountElement = document.getElementById("collection-count");
const statusElement = document.getElementById("draw-status");
const rarityFiltersElement = document.getElementById("rarity-filters");

const RARITIES = ["LR", "UR", "SSR", "SR", "R", "UC", "C"];
// 初期排出確率（全レアリティが登録されている場合）
// 値が小さいほど出にくくなります。必要ならここを変更してください。
const RARITY_WEIGHTS = { LR: 1, UR: 3, SSR: 6, SR: 12, R: 18, UC: 25, C: 35 };
let activeRarity = "ALL";
let collection = loadCollection();

function loadCollection() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCollection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}


// レアリティを先に抽選し、そのレアリティのカードから1枚を選びます。
// 各レアリティのカード登録枚数が違っても、レアリティ自体の確率は変わりません。
function drawOneCard() {
  const available = RARITIES.filter(r => cards.some(card => (card.rarity || "C") === r));
  if (!available.length) return null;
  const total = available.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  let roll = Math.random() * total;
  let selected = available[available.length - 1];
  for (const rarity of available) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) { selected = rarity; break; }
  }
  const pool = cards.filter(card => (card.rarity || "C") === selected);
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderOdds() {
  const target = document.getElementById("rarity-odds");
  if (!target) return;
  target.replaceChildren();
  const available = RARITIES.filter(r => cards.some(card => (card.rarity || "C") === r));
  const total = available.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  RARITIES.forEach(r => {
    const row = document.createElement("div");
    row.className = "odds-row";
    const badge = document.createElement("span");
    badge.className = `rarity-badge rarity-${r}`;
    badge.textContent = r;
    const value = document.createElement("span");
    if (available.includes(r)) {
      const pct = RARITY_WEIGHTS[r] / total * 100;
      value.textContent = `${Number(pct.toFixed(2))}%`;
    } else {
      value.textContent = "カード未登録";
      value.className = "muted";
    }
    row.append(badge, value);
    target.appendChild(row);
  });
}

function makeCardElement(card, count = null) {
  const article = document.createElement("article");
  article.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  if (card.image) {
    const img = document.createElement("img");
    img.className = "card-image";
    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";
    img.onerror = () => {
      imageWrap.innerHTML = '<div class="image-fallback" aria-label="画像なし">✦</div>';
    };
    imageWrap.appendChild(img);
  } else {
    imageWrap.innerHTML = '<div class="image-fallback" aria-label="画像なし">✦</div>';
  }

  const info = document.createElement("div");
  info.className = "card-info";
  const rarity = document.createElement("span");
  rarity.className = `rarity-badge rarity-${RARITIES.includes(card.rarity) ? card.rarity : "C"}`;
  rarity.textContent = RARITIES.includes(card.rarity) ? card.rarity : "C";
  const name = document.createElement("h3");
  name.className = "card-name";
  name.textContent = card.name;
  info.append(rarity, name);

  if (card.description) {
    const description = document.createElement("p");
    description.className = "card-description";
    description.textContent = card.description;
    info.appendChild(description);
  }
  if (count !== null) {
    const owned = document.createElement("p");
    owned.className = "owned-count";
    owned.textContent = `所持枚数：${count}枚`;
    info.appendChild(owned);
  }
  article.append(imageWrap, info);
  return article;
}

function showResults(drawnCards) {
  resultsElement.replaceChildren();
  drawnCards.forEach((card, index) => {
    const element = makeCardElement(card);
    element.style.animationDelay = `${index * 90}ms`;
    resultsElement.appendChild(element);
  });
  resultCountElement.textContent = `${drawnCards.length} / 5`;
}

function renderRarityFilters() {
  rarityFiltersElement.replaceChildren();
  const options = [{ value: "ALL", label: "すべて" }, ...RARITIES.map(r => ({ value: r, label: r }))];
  options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rarity-filter${activeRarity === option.value ? " active" : ""}`;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(activeRarity === option.value));
    button.addEventListener("click", () => {
      activeRarity = option.value;
      renderRarityFilters();
      renderCollection();
    });
    rarityFiltersElement.appendChild(button);
  });
}

function renderCollection() {
  collectionElement.replaceChildren();
  const allOwned = cards
    .filter(card => Number(collection[card.id]) > 0)
    .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.name.localeCompare(b.name, "ja"));
  const ownedCards = activeRarity === "ALL" ? allOwned : allOwned.filter(card => card.rarity === activeRarity);
  collectionCountElement.textContent = `${allOwned.length}種類`;

  if (ownedCards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = allOwned.length === 0
      ? "まだカードを引いていません。"
      : `${activeRarity} のカードはまだ持っていません。`;
    collectionElement.appendChild(empty);
    return;
  }
  ownedCards.forEach(card => collectionElement.appendChild(makeCardElement(card, collection[card.id])));
}

drawButton.addEventListener("click", () => {
  if (!Array.isArray(cards) || cards.length === 0) {
    statusElement.textContent = "cards.js にカードを登録してください。";
    return;
  }
  // 5回それぞれ抽選するため、同じカードが重複することがあります。
  const drawnCards = Array.from({ length: 5 }, drawOneCard).filter(Boolean);
  drawnCards.forEach(card => { collection[card.id] = (Number(collection[card.id]) || 0) + 1; });
  saveCollection();
  showResults(drawnCards);
  renderCollection();
  statusElement.textContent = "5枚引きました。レアリティは各カードに表示されます。";
});

clearButton.addEventListener("click", () => {
  if (!window.confirm("このブラウザに保存された所持記録をすべて消しますか？")) return;
  collection = {};
  saveCollection();
  renderCollection();
  resultsElement.innerHTML = '<div class="empty-state">ここに引いたカードが表示されます。</div>';
  resultCountElement.textContent = "0 / 5";
  statusElement.textContent = "所持記録をリセットしました。";
});

renderRarityFilters();
renderOdds();
renderCollection();
