/**
 * @fileoverview home.js — costruzione della Home.
 *
 * Costruisce nella `.home` le righe (sezioni):
 * - "Riprodotti di recente" (da `getHistory()`) — mostrata solo se non vuota
 * - "I tuoi preferiti" (da `getFavourites()`) — mostrata solo se non vuota
 * - "Suggerimenti pop" / "rock" / "hits" (fetch all'API iTunes, in parallelo con `Promise.all`)
 *
 * Ogni card è una {@link Track}: cover, titolo, artista, bottone play,
 * bottone cuore (favourite). Click sulla card (cover inclusa) -> `window.player.play(track)`.
 * Niente link ad album.html qui: in questa pagina ogni card è un brano, non un album.
 */

const player = initPage();
const home = document.querySelector(".home");
const searchInput = document.getElementById("search-input");

//con questa richiesta HTTP GET chiedo all API di Apple di darmi media=music ed entitty=song
// e il CDN diApple mi restituisce delle demo da 30 secondi
const API_URL = "https://itunes.apple.com/search";

// 1 PRIMA FUNZIONA ASINCORNA

// gli do try catch per ridare errore all utente in caso di internet
//  non funzionante o server Apple in down

/*  if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }


    // uso un map per prendere tutti i dati disordinati che la API mi restituisce
    //e ne ricostruisco un array pulito con ID, tracks , artist ,
    // cover , audioURL (pee riprodurre la canzone) e albumID
    const tracks = data.results.map((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      cover: track.artworkUrl100,
      previewUrl: track.previewUrl,
      albumId: track.collectionId,
    }));*/
/**
 * Cerca brani sull'API iTunes per un termine, filtrando opzionalmente per
 * genere e limitando opzionalmente la ricerca a un paese.
 *
 * @param {string} term - Termine di ricerca.
 * @param {(string|string[])} [genre] - Genere (o generi) da cui filtrare i risultati (case-insensitive, match parziale su `primaryGenreName`).
 * @param {string} [country] - Codice paese (es. `"IT"`) da passare all'API.
 * @returns {Promise<Track[]>} Al più 25 brani che soddisfano il filtro, o array vuoto in caso di errore.
 */
const fetchTracksByTerm = async (term, genre, country) => {
  try {
    const countryParam = country ? `&country=${country}` : "";
    const url = `${API_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=50${countryParam}`;
    const data = await fetchJSONP(url);
    // genre può essere una stringa singola o un array di stringhe
    const genres = genre ? (Array.isArray(genre) ? genre : [genre]) : null;
    const results = genres
      ? data.results.filter((raw) => {
          const g = (raw.primaryGenreName || "").toLowerCase();
          return genres.some((t) => g.includes(t.toLowerCase()));
        })
      : data.results;
    const tracks = results.slice(0, 25).map((raw) => new Track(raw));
    return tracks;
  } catch (error) {
    console.error(`Errore nel fetch per "${term}":`, error);
    //nel caso vai in errore , restituiscimi un array vuoto
    return [];
  }
};

// 2 FUNZIONE HOME fai un loadhgome ad ogni avvio di pagina

/** @type {string[]} ID delle sezioni `<section>` di righe della Home, da nascondere finché non hanno dati. */
const ROW_SECTION_IDS = [
  "row-history",
  "row-favourites",
  "row-pop",
  "row-rock",
  "row-hits",
];

/**
 * Carica e renderizza tutte le righe della Home: storico e preferiti
 * (da localStorage), poi i tre suggerimenti pop/rock/hits in parallelo via
 * `Promise.all`. In caso di errore critico mostra un messaggio al posto della home.
 *
 * @returns {Promise<void>}
 */
const loadHome = async () => {
  try {
    // tutte le sezioni partono nascoste, renderRow le mostra solo se ha dati
    ROW_SECTION_IDS.forEach((id) =>
      document.getElementById(id)?.classList.add("d-none"),
    );

    const historyTracks = typeof getHistory === "function" ? getHistory() : [];
    const favouriteTracks =
      typeof getFavourites === "function" ? getFavourites() : [];

    if (historyTracks && historyTracks.length > 0) {
      renderRow("Riprodotti di recente", historyTracks);
    }

    if (favouriteTracks && favouriteTracks.length > 0) {
      renderRow("I tuoi preferiti", favouriteTracks);
    }
    // gli do un promise all per non chiamare 3 API una
    // dopo laltra ma tutte insieme e snellire il cariacamento
    const [popTracks, rockTracks, hitsTracks] = await Promise.all([
      fetchTracksByTerm("pop", "Pop"),
      fetchTracksByTerm("rock", ["rock", "alternative", "metal", "punk", "grunge", "indie"]),
      fetchTracksByTerm("pop italiano", "Pop", "IT"),
    ]);

    if (popTracks.length > 0) renderRow("Suggerimenti pop", popTracks);
    if (rockTracks.length > 0) renderRow("Suggerimenti rock", rockTracks);
    if (hitsTracks.length > 0) renderRow("Suggerimenti hits", hitsTracks);
  } catch (globalError) {
    console.error("Errore critico nel loadHome:", globalError);
    const errorMsg = document.createElement("p");
    errorMsg.classList.add("text-danger", "text-center", "p-4");
    errorMsg.textContent = "Errore nel caricamento della pagina.";
    home.replaceChildren(errorMsg);
  }
};
// 3 RENDER DELLE CARD: clona #tmpl-card per ogni track e popola img/titolo/artista

/** @type {Object<string, string>} Mappa titolo riga -> ID della `<section>` statica corrispondente in HTML. */
const ROW_IDS = {
  "Basata sui tuoi gusti": "row-ai",
  "Riprodotti di recente": "row-history",
  "I tuoi preferiti": "row-favourites",
  "Suggerimenti pop": "row-pop",
  "Suggerimenti rock": "row-rock",
  "Suggerimenti hits": "row-hits",
};
const tmplCard = document.getElementById("tmpl-card");

/* const buildCard = (track) => {
  const card = tmplCard.content.firstElementChild.cloneNode(true);

  const img = card.querySelector("img");
  img.src = track.cover;
  img.alt = track.title;

  const cardTitle = card.querySelector(".card-title");
  cardTitle.textContent = track.title;
  cardTitle.classList.add("text-white");
  card.querySelector(".card-sub").textContent = track.artist;

  const btnFav = card.querySelector(".card-fav");
  btnFav.classList.toggle("is-fav", isFavourite(track.id));
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
  });

  // qui attacco il mio "+" sulla card per mettere il brano in una playlist
  card.querySelector(".card-image-wrap").appendChild(
    makeAddButton(track, "card-add"),
  );

  card.querySelector(".card-play").addEventListener("click", (event) => {
    event.stopPropagation();
    window.player.play(track);
  });

  card.addEventListener("click", () => window.player.play(track));

  return card;
}; 
*/

// CARD DEI CONSIGLIATI PER POTER SENTIRE PIU' TRACCE SUI CONSIGLIA

/**
 * Clona `#tmpl-card` e la popola con i dati di un brano: cover, titolo,
 * artista (link ad artist.html), bottone preferito, bottone "+" playlist e
 * bottone/click di play. Il click su play/card passa l'intera tracklist
 * della riga al player, per abilitare next/prev sull'intera riga.
 *
 * @param {Track} track - Brano da mostrare nella card.
 * @param {Track[]} [currentTracklist=[]] - Tracklist della riga, passata a `window.player.play()` per next/prev.
 * @returns {Element} Elemento `.card` pronto per essere inserito nel DOM.
 */
const buildCard = (track, currentTracklist = []) => {
  const card = tmplCard.content.firstElementChild.cloneNode(true);
  card.dataset.id = track.id;    // serve a Player.updateNowPlayingUI() per evidenziare la card in riproduzione
  card.dataset.genre = (track.genre || "").toLowerCase(); // serve al filtro generi della sidebar

  const img = card.querySelector("img");
  img.src = track.cover;
  img.alt = track.title;

  card.querySelector(".card-title").textContent = track.title;

  // card-sub è un <a>: href porta su artist.html; stopPropagation evita che il click lanci anche il play
  const sub = card.querySelector(".card-sub");
  sub.textContent = track.artist;
  sub.href = `artist.html?id=${track.artistId}`;
  sub.addEventListener("click", (e) => e.stopPropagation());

  const btnFav = card.querySelector(".card-fav");
  const heartIcon = btnFav.querySelector("ion-icon");
  const initFav = isFavourite(track.id);
  btnFav.classList.toggle("is-fav", initFav);
  if (heartIcon) heartIcon.setAttribute("name", initFav ? "heart" : "heart-outline");
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    const nowFav = isFavourite(track.id);
    btnFav.classList.toggle("is-fav", nowFav);
    if (heartIcon) heartIcon.setAttribute("name", nowFav ? "heart" : "heart-outline");
  });

  // qui attacco il "+" sulla card per mettere il brano in una playlist (come nelle card di ricerca)
  card.querySelector(".card-image-wrap").appendChild(makeAddButton(track, "card-add"));

  card.querySelector(".card-play").addEventListener("click", (event) => {
    event.stopPropagation();
    window.player.play(track, currentTracklist); // <-- MODIFICA: Passa la riga al player
  });

  card.addEventListener("click", () => window.player.play(track, currentTracklist)); // <-- MODIFICA: Passa la riga al player

  return card;
};

/**
 * Renderizza una riga di card nella Home: usa la `<section>` statica
 * corrispondente se `rowTitle` è in {@link ROW_IDS}, altrimenti ne crea una
 * nuova in coda alla `.home`.
 *
 * @param {string} rowTitle - Titolo della riga (chiave di {@link ROW_IDS} per le righe statiche).
 * @param {Track[]} tracks - Brani da mostrare nella riga.
 * @returns {void}
 */
const renderRow = (rowTitle, tracks) => {
  const knownId = ROW_IDS[rowTitle];
  let container;

  if (knownId) {
    const section = document.getElementById(knownId);
    if (!section) return;
    section.classList.remove("d-none");
    container = section.querySelector(".d-flex");
  } else {
    const heading = document.createElement("h2");
    heading.classList.add("fs-5", "mb-3");
    heading.textContent = rowTitle;

    const list = document.createElement("div");
    list.classList.add("d-flex", "gap-3", "overflow-x-auto", "pb-2");

    const section = document.createElement("section");
    section.classList.add("mb-5");
    section.append(heading, list);

    home.appendChild(section);
    container = list;
  }

  // Passa esplicitamente sia la traccia singola sia l'intero array 'tracks' della riga
  const nuoveCards = tracks.map((track) => buildCard(track, tracks));

  // La riga AI accumula i consigli nel tempo invece di sovrascriverli: unisco vecchie e nuove card e dedup per titolo+artista
  if (knownId === "row-ai") {
    const tutteLeCard = [...Array.from(container.children), ...nuoveCards];
    const idVisti = new Set();
    const cardUniche = [];
    tutteLeCard.forEach((card) => {
      const titolo = card.querySelector(".card-title")?.textContent || "";
      const artista = card.querySelector(".card-sub")?.textContent || "";
      const chiave = `${titolo}-${artista}`.toLowerCase().trim();
      if (!idVisti.has(chiave) && chiave !== "-") {
        idVisti.add(chiave);
        cardUniche.push(card);
      }
    });
    container.replaceChildren(...cardUniche);
  } else {
    container.replaceChildren(...nuoveCards);
  }
};
/**
 * Salva il termine digitato e naviga alla pagina di ricerca dedicata.
 * Chiamata in modo "debounced" (vedi {@link debouncedGoToSearch}) mentre si digita.
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
 * Attacca i listener ai bottoni `<` `>` di ogni `.row-scroller` già presente
 * nell'HTML (scroll orizzontale di una card alla volta) e abilita il
 * drag-to-scroll orizzontale tenendo premuto e trascinando. Chiamata prima
 * di `loadHome()` così i listener sono pronti quando le card vengono inserite.
 *
 * @returns {void}
 */
const initRowNav = () => {
  document.querySelectorAll(".row-scroller").forEach((scroller) => {
    const list = scroller.querySelector(".d-flex");
    if (!list) return;
    // calcola lo scroll di una card alla volta in modo dinamico:
    // offsetWidth della prima card + gap-3 Bootstrap (1rem = 16px)
    const getAmt = () => (list.firstElementChild?.offsetWidth ?? 160) + 16;
    scroller.querySelector(".row-btn-prev")?.addEventListener("click", () =>
      list.scrollBy({ left: -getAmt(), behavior: "smooth" })
    );
    scroller.querySelector(".row-btn-next")?.addEventListener("click", () =>
      list.scrollBy({ left: getAmt(), behavior: "smooth" })
    );

    // drag-to-scroll: tieni premuto e trascina per scorrere orizzontalmente
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let startScrollLeft = 0;

    list.addEventListener("mousedown", (e) => {
      isDragging = true;
      hasDragged = false;
      startX = e.pageX - list.offsetLeft;
      startScrollLeft = list.scrollLeft;
      list.style.cursor = "grabbing";
      e.preventDefault();
    });

    list.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      hasDragged = true;
      const x = e.pageX - list.offsetLeft;
      list.scrollLeft = startScrollLeft - (x - startX);
    });

    const stopDrag = () => {
      if (isDragging && hasDragged) {
        // intercetta e blocca il click che segue il mouseup, poi si auto-rimuove
        list.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
      }
      isDragging = false;
      list.style.cursor = "";
    };
    list.addEventListener("mouseup", stopDrag);
    list.addEventListener("mouseleave", stopDrag);
  });
};

initRowNav();
loadHome();

//da qui lucio deve creare la funzione dei filtri e fargli un eventlistener