/* ============================================================
   home.js — costruzione della Home
   ============================================================

   COSA DEVI FARE
   1) initPage("home")  // monta sidebar + player
   2) Costruisci queste righe (sezioni) nella .home:
        - "Riprodotti di recente" (da getHistory())  -- mostra solo se non vuota
        - "I tuoi preferiti"       (da getFavourites()) -- mostra solo se non vuota
        - "Suggerimenti pop"       (fetch search term=pop entity=song limit=12)
        - "Suggerimenti rock"      (fetch search term=rock entity=song limit=12)
        - "Suggerimenti hits"   (fetch search term=hits pop entity=song limit=12)
   3) Le tre fetch dei suggerimenti vanno in PARALLELO con Promise.all
   4) Ogni card è una Track: cover, titolo, artista, button play, button cuore (favourite)
   5) Click card (cover inclusa) -> window.player.play(track)
      Niente link ad album.html qui: in questa pagina ogni card è un brano,
      non un album.
*/

const player = initPage("home");
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
const fetchTracksByTerm = async (term, genre, country) => {
  try {
    const countryParam = country ? `&country=${country}` : "";
    const url = `${API_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=50${countryParam}`;
    const response = await fetch(url);
    const data = await response.json();
    const results = genre
      ? data.results.filter((raw) =>
          (raw.primaryGenreName || "").toLowerCase().includes(genre.toLowerCase()),
        )
      : data.results;
    const tracks = results.slice(0, 12).map((raw) => new Track(raw));
    return tracks;
  } catch (error) {
    console.error(`Errore nel fetch per "${term}":`, error);
    //nel caso vai in errore , restituiscimi un array vuoto
    return [];
  }
};

// 2 FUNZIONE HOME fai un loadhgome ad ogni avvio di pagina
const ROW_SECTION_IDS = [
  "row-history",
  "row-favourites",
  "row-pop",
  "row-rock",
  "row-hits",
];

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
      fetchTracksByTerm("rock", "Rock"),
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
const ROW_IDS = {
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

// CARD DEI CONSIGLIATI PER POTER SENTIRE PIU' TRACCE SUI CONSIGLIA (Marco)

const buildCard = (track, currentTracklist = []) => { // <-- MODIFICA: Accetta l'array della riga
  const card = tmplCard.content.firstElementChild.cloneNode(true);

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
  btnFav.classList.toggle("is-fav", isFavourite(track.id));
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
  });

  card.querySelector(".card-play").addEventListener("click", (event) => {
    event.stopPropagation();
    window.player.play(track, currentTracklist); // <-- MODIFICA: Passa la riga al player
  });

  card.addEventListener("click", () => window.player.play(track, currentTracklist)); // <-- MODIFICA: Passa la riga al player

  return card;
};

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

  // container.replaceChildren(...tracks.map(buildCard));

  // MODIFICA: Passa esplicitamente sia la traccia singola sia l'intero array 'tracks' della riga
  container.replaceChildren(...tracks.map(track => buildCard(track, tracks)));
};
// appena digiti almeno 3 lettere, salva il termine e vai alla pagina di ricerca dedicata
const goToSearch = (term) => {
  if (term.length >= 1) {
    localStorage.setItem(STORAGE_KEY_LAST_SEARCH, term);
    window.location.href = "search.html";
  }
};
const debouncedGoToSearch = debounce(goToSearch, 400);

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    debouncedGoToSearch(event.target.value.trim());
  });
}

loadHome();

//da qui lucio deve creare la funzione dei filtri e fargli un eventlistener
