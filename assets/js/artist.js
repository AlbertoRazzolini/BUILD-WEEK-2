/**
 * @fileoverview artist.js — pagina dettaglio artista.
 *
 * Legge l'id dell'artista dalla query string (`?id=...`); se manca, mostra
 * "Artista non trovato". Altrimenti fa `fetch /lookup?id=ID&entity=song&limit=15`
 * (`results[0]` è l'artist, `results[1..]` sono le top track) e costruisce:
 * - `#artist-hero`: kicker "ARTISTA", nome artista, genere + numero
 *   ascoltatori (generato casualmente, l'API iTunes non lo fornisce),
 *   bottone Play sulla prima track
 * - `#top-tracks`: tracklist (stessa struttura di album.js)
 */

const player = initPage();

const artistHero = document.querySelector("#artist-hero");
const topTracks  = document.querySelector("#top-tracks");
const searchInput = document.getElementById("search-input");

/**
 * Salva il termine digitato e naviga alla pagina di ricerca dedicata.
 *
 * @param {string} term - Termine di ricerca da salvare.
 * @returns {void}
 */
const goToSearch = (term) => {
  if (term.length >= 1) {
    localStorage.setItem(STORAGE_KEY_LAST_SEARCH, term);
    window.location.href = "search.html";
  }
};
/** @type {Function} Versione "debounced" (400ms) di {@link goToSearch}. */
const debouncedGoToSearch = debounce(goToSearch, 400);

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    debouncedGoToSearch(event.target.value.trim());
  });
}

/**
 * Mostra il messaggio "Artista non trovato" al posto dell'hero e svuota le top tracks.
 *
 * @returns {void}
 */
const showNotFound = () => {
  const msg = document.createElement("p");
  msg.textContent = "Artista non trovato";
  artistHero.replaceChildren(msg);
  topTracks.replaceChildren();
};

/**
 * Costruisce `#artist-hero`: cover circolare (presa dal primo brano, l'API
 * iTunes non fornisce foto artista), kicker "ARTISTA", nome, sotto-riga
 * (genere · ascoltatori mensili generati casualmente) e bottone Play che
 * avvia `firstTrack` con `tracks` come tracklist.
 *
 * @param {Artist} artist - Artista corrente.
 * @param {Track} firstTrack - Prima top track, usata per la cover e avviata dal bottone Play.
 * @param {Track[]} [tracks=[]] - Top tracks dell'artista, passate al player per next/prev.
 * @returns {void}
 */
const renderHero = (artist, firstTrack, tracks = []) => {
  const listeners = Math.floor(Math.random() * 5_000_000);

  // cover: usa la copertina del primo brano (iTunes API non fornisce foto artista)
  const cover = document.createElement("div");
  cover.classList.add("album-cover");
  cover.style.borderRadius = "50%"; // forma circolare — convenzione visiva per gli artisti
  if (firstTrack && firstTrack.cover) {
    const coverImg = document.createElement("img");
    coverImg.src = bigArt(firstTrack.cover);
    coverImg.alt = artist.name;
    cover.appendChild(coverImg);
  }

  const kicker = document.createElement("p");
  kicker.classList.add("hero-kicker");
  kicker.textContent = "ARTISTA";

  const title = document.createElement("h1");
  title.classList.add("hero-title");
  title.textContent = artist.name;

  const sub = document.createElement("p");
  sub.classList.add("hero-sub");
  sub.textContent = `${artist.genre || "Artista"} · ${listeners.toLocaleString("it-IT")} ascoltatori mensili`;

  const btnPlay = document.createElement("button");
  btnPlay.classList.add("btn-play-big");
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.addEventListener("click", () => player.play(firstTrack, tracks));

  const actions = document.createElement("div");
  actions.classList.add("hero-actions");
  actions.append(btnPlay);

  const meta = document.createElement("div");
  meta.classList.add("hero-meta");
  meta.append(kicker, title, sub, actions);

  artistHero.replaceChildren(cover, meta);
};

/**
 * Costruisce `#top-tracks`: una riga per traccia con numero, titolo, durata,
 * bottone preferito e bottone "+" playlist. Click sulla riga -> `player.play(track, tracks)`.
 *
 * @param {Track[]} tracks - Top tracks dell'artista da renderizzare.
 * @returns {void}
 */
const renderTopTracks = (tracks) => {
  const rows = tracks.map((track, index) => {
    const num = document.createElement("span");
    num.classList.add("track-num");
    num.textContent = String(index + 1);

    const trackTitle = document.createElement("span");
    trackTitle.classList.add("track-title");
    trackTitle.textContent = track.title;

    const time = document.createElement("span");
    time.classList.add("track-time");
    time.textContent = formatTime(track.durationMs);

    const btnFav = document.createElement("button");
    btnFav.classList.add("track-fav");
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
    btnFav.setAttribute("aria-label", "Preferito");
    const heartIcon = document.createElement("ion-icon");
    heartIcon.setAttribute("name", isFavourite(track.id) ? "heart" : "heart-outline");
    btnFav.appendChild(heartIcon);
    btnFav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavourite(track);
      const nowFav = isFavourite(track.id);
      btnFav.classList.toggle("is-fav", nowFav);
      heartIcon.setAttribute("name", nowFav ? "heart" : "heart-outline");
    });

    // qui metto il mio "+" sulla riga per aggiungere il brano a una playlist
    const btnAdd = makeAddButton(track, "track-add");

    const row = document.createElement("div");
    row.classList.add("track-row");
    row.dataset.id = track.id;
    row.append(num, trackTitle, time, btnFav, btnAdd);
    row.addEventListener("click", () => player.play(track, tracks)); // MARCO- aggiunto ,tracks

    return row;
  });

  topTracks.replaceChildren(...rows);
};

/**
 * Legge l'id artista dalla query string, recupera artista e top track
 * dall'API iTunes e renderizza hero + top tracks. Mostra "Artista non
 * trovato" se manca l'id, l'artista non esiste o non ha tracce.
 *
 * @returns {Promise<void>}
 */
const loadArtist = async () => {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    showNotFound();
    return;
  }

  const data = await fetchJSON(`${API_BASE}/lookup?id=${id}&entity=song&limit=15`);

  if (!data.results.length) {
    showNotFound();
    return;
  }

  const artist = new Artist(data.results[0]);
  const tracks = data.results.slice(1).map((raw) => new Track(raw));

  if (!tracks.length) {
    showNotFound();
    return;
  }

  renderHero(artist, tracks[0], tracks); // // MARCO- aggiunto ,tracks
  renderTopTracks(tracks);
};

loadArtist();