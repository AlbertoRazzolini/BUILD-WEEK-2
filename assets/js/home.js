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
const fetchTracksByTerm = async (term) => {
  // gli do try catch per ridare errore all utente in caso di internet
  //  non funzionante o server Apple in down
  try {
    const url = `${API_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=12`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

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
    }));
    console.log(`Dati ricevuti per "${term}":`, tracks);
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
      fetchTracksByTerm("pop"),
      fetchTracksByTerm("rock"),
      fetchTracksByTerm("hits"),
    ]);

    if (popTracks.length > 0) renderRow("Suggerimenti pop", popTracks);
    if (rockTracks.length > 0) renderRow("Suggerimenti rock", rockTracks);
    if (hitsTracks.length > 0) renderRow("Suggerimenti hits", hitsTracks);
  } catch (globalError) {
    console.error("Errore critico nel loadHome:", globalError);
    home.innerHTML = `<p class="text-danger text-center p-4">Errore nel caricamento della pagina.</p>`;
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

const buildCard = (track) => {
  const card = tmplCard.content.firstElementChild.cloneNode(true);

  const img = card.querySelector("img");
  img.src = track.cover;
  img.alt = track.title;

  card.querySelector(".card-title").textContent = track.title;
  card.querySelector(".card-sub").textContent = track.artist;

  const btnFav = card.querySelector(".card-fav");
  btnFav.classList.toggle("is-fav", isFavourite(track.id));
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
  });

  card.querySelector(".card-play").addEventListener("click", (event) => {
    event.stopPropagation();
    window.player.play(track);
  });

  card.addEventListener("click", () => window.player.play(track));

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
    const section = document.createElement("section");
    section.className = "mb-5";
    section.innerHTML = `<h2 class="fs-5 mb-3">${rowTitle}</h2><div class="d-flex gap-3 overflow-x-auto pb-2"></div>`;
    home.appendChild(section);
    container = section.querySelector(".d-flex");
  }

  container.replaceChildren(...tracks.map(buildCard));
};
// quando vai su invio salva il termine e vai alla pagina di ricerca dedicata
// (search.js gestisce la ricerca vera con debounce, album e artisti)
if (searchInput) {
  searchInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const valoreCercato = event.target.value.trim();
      if (valoreCercato !== "") {
        localStorage.setItem(STORAGE_KEY_LAST_SEARCH, valoreCercato);
        window.location.href = "search.html";
      }
    }
  });
}

loadHome();

//da qui lucio deve creare la funzione dei filtri e fargli un eventlistener
