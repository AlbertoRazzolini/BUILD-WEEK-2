/**
 * @fileoverview search.js — ricerca con debounce.
 *
 * Recupera l'ultima query da localStorage (`STORAGE_KEY_LAST_SEARCH`): se
 * presente, popola l'input e lancia la ricerca. L'evento "input" su
 * `#search-input` è agganciato con debounce 400ms.
 *
 * {@link doSearch} esegue in parallelo (`Promise.all`) la ricerca di tracce,
 * album e artisti, mostra ciascuna sezione solo se ha risultati e salva
 * l'ultima query in localStorage.
 *
 * Per ogni risultato si crea una card:
 * - track  -> click = `player.play(track)`
 * - album  -> click = `window.location.href = "album.html?id=" + albumId`
 * - artist -> click = `window.location.href = "artist.html?id=" + artistId`
 */

const player = initPage();

const input        = document.querySelector("#search-input");
const rowTracks    = document.querySelector("#row-tracks");
const rowAlbums    = document.querySelector("#row-albums");
const rowArtists   = document.querySelector("#row-artists");
const gridTracks   = document.querySelector("#grid-tracks");
const gridAlbums   = document.querySelector("#grid-albums");
const gridArtists  = document.querySelector("#grid-artists");

/**
 * Crea una card di risultato per un brano: cover, bottone "+" playlist,
 * bottone preferito, bottone play, titolo e artista (link ad artist.html).
 * Click sulla card o sul bottone play -> `player.play(track, tracklist)`.
 *
 * @param {Track} track - Brano da mostrare nella card.
 * @param {Track[]} [tracklist=[]] - Tracklist dei risultati, passata al player per next/prev.
 * @returns {Element} Elemento `.card` pronto per essere inserito nel DOM.
 */
const renderTrackCard = (track, tracklist = []) => {
  const card = document.createElement("div");
  card.classList.add("card");
  card.dataset.id = track.id;

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap");
  const img = document.createElement("img");
  img.src = bigArt(track.cover);
  img.alt = track.title;
  imageWrap.appendChild(img);

  // card-add ("+") in alto a sinistra dentro imageWrap — coerente con le card della home
  imageWrap.appendChild(makeAddButton(track, "card-add"));

  // card-fav (cuore) in alto a destra dentro imageWrap — coerente con le card della home
  const btnFav = document.createElement("button");
  btnFav.classList.add("card-fav");
  const initFav = isFavourite(track.id);
  btnFav.classList.toggle("is-fav", initFav);
  btnFav.setAttribute("aria-label", "Preferito");
  const heartIcon = document.createElement("ion-icon");
  heartIcon.setAttribute("name", initFav ? "heart" : "heart-outline");
  btnFav.appendChild(heartIcon);
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    const nowFav = isFavourite(track.id);
    btnFav.classList.toggle("is-fav", nowFav);
    heartIcon.setAttribute("name", nowFav ? "heart" : "heart-outline");
  });
  imageWrap.appendChild(btnFav);

  const btnPlay = document.createElement("button");
  btnPlay.classList.add("card-play");
  btnPlay.setAttribute("aria-label", "Play");
  const playIcon = document.createElement("ion-icon");
  playIcon.setAttribute("name", "play-outline");
  btnPlay.appendChild(playIcon);
  btnPlay.addEventListener("click", (event) => {
    event.stopPropagation();
    player.play(track, tracklist);
  });
  imageWrap.appendChild(btnPlay);

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = track.title;

  const sub = document.createElement("a");
  sub.className = "card-sub";
  sub.textContent = track.artist;
  sub.href = `artist.html?id=${track.artistId}`;
  sub.addEventListener("click", (e) => e.stopPropagation());

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => player.play(track, tracklist));

  return card;
};

/**
 * Crea una card di risultato per un album: cover, titolo e artista (link ad
 * artist.html). Click sulla card -> naviga ad album.html.
 *
 * @param {Album} album - Album da mostrare nella card.
 * @returns {Element} Elemento `.card` pronto per essere inserito nel DOM.
 */
const renderAlbumCard = (album) => {
  const card = document.createElement("div");
  card.classList.add("card");

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap");
  const img = document.createElement("img");
  img.src = album.cover;
  img.alt = album.title;
  imageWrap.appendChild(img);

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = album.title;

  // artista dell'album come link: click → artist.html; stopPropagation evita di attivare anche il click sull'intera card (album.html)
  const sub = document.createElement("a");
  sub.className = "card-sub";
  sub.textContent = album.artist;
  sub.href = `artist.html?id=${album.artistId}`;
  sub.addEventListener("click", (e) => e.stopPropagation());

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `album.html?id=${album.id}`;
  });

  return card;
};

/**
 * Crea una card di risultato per un artista: placeholder 🎤, nome e genere.
 * Click sulla card -> naviga ad artist.html.
 *
 * @param {Artist} artist - Artista da mostrare nella card.
 * @returns {Element} Elemento `.card` pronto per essere inserito nel DOM.
 */
const renderArtistCard = (artist) => {
  const card = document.createElement("div");
  card.classList.add("card");

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap", "round");
  imageWrap.style.display = "grid";
  imageWrap.style.placeItems = "center";
  imageWrap.style.fontSize = "32px";
  imageWrap.textContent = "🎤";

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = artist.name;

  const sub = document.createElement("p");
  sub.classList.add("card-sub");
  sub.textContent = artist.genre || "Artista";

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `artist.html?id=${artist.id}`;
  });

  return card;
};

/**
 * Popola una griglia di risultati con le card costruite da `renderCard` e
 * mostra/nasconde la sezione in base al numero di risultati.
 *
 * @param {Element} section - Sezione `<section>` da mostrare/nascondere.
 * @param {Element} grid - Contenitore griglia da popolare.
 * @param {Array<Object>} items - Elementi (Track/Album/Artist) da renderizzare.
 * @param {function(Object): Element} renderCard - Funzione che costruisce la card per un elemento.
 * @returns {void}
 */
const showRow = (section, grid, items, renderCard) => {
  grid.replaceChildren(...items.map(renderCard));
  section.hidden = items.length === 0;
};

/**
 * Esegue la ricerca per un termine: se vuoto nasconde le tre righe risultati,
 * altrimenti effettua in parallelo (`Promise.all`) la ricerca di tracce,
 * album e artisti sull'API iTunes, popola le rispettive righe e salva il
 * termine come ultima ricerca in localStorage.
 *
 * @param {string} term - Termine di ricerca.
 * @returns {Promise<void>}
 */
const doSearch = async (term) => {
  if (!term || term.length < 1) {
    showRow(rowTracks, gridTracks, [], renderTrackCard);
    showRow(rowAlbums, gridAlbums, [], renderAlbumCard);
    showRow(rowArtists, gridArtists, [], renderArtistCard);
    return;
  }

  localStorage.setItem(STORAGE_KEY_LAST_SEARCH, term);

  const [tracksData, albumsData, artistsData] = await Promise.all([
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=song&limit=20`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=album&limit=8`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=8`,
    ),
  ]);

  const tracks = tracksData.results.map((raw) => new Track(raw));
  showRow(rowTracks, gridTracks, tracks, (track) => renderTrackCard(track, tracks));
  showRow(rowAlbums, gridAlbums, albumsData.results.map((raw) => new Album(raw)), renderAlbumCard);
  showRow(rowArtists, gridArtists, artistsData.results.map((raw) => new Artist(raw)), renderArtistCard);
};

/** @type {Function} Versione "debounced" (400ms) di {@link doSearch}. */
const debouncedSearch = debounce(doSearch, 400);

input.addEventListener("input", (event) => {
  debouncedSearch(event.target.value.trim());
});

const lastQuery = localStorage.getItem(STORAGE_KEY_LAST_SEARCH);
if (lastQuery) {
  input.value = lastQuery;
  doSearch(lastQuery);
}