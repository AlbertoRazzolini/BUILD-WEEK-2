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
   5) Click card -> window.player.play(track)
   6) Click cover senza play -> link a album.html?id=albumId (opzionale)
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
      audioUrl: track.previewUrl,
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
const loadHome = async () => {
  try {
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
// 3 FUNZIONE PER LA RICERCA DA DARE A SIMO E CRI
//da qui simo e cri dovrebbero riempire larray di tracks e ,
// generare dalle variabili track.title , tarck.cover etc appenderle all HTML
//e poi creare la gethistory per la cronologia e getfavourites per i preferiti
const renderRow = (rowTitle, tracks) => {
  console.log(`Dati pronti per la riga "${rowTitle}":`, tracks);
};
//quando vai su invio chiama la mia prima funzione "fetchTracksByTerm" e passa a renderRow
if (searchInput) {
  searchInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
      const valoreCercato = event.target.value.trim();
      if (valoreCercato !== "") {
        console.log(`Ricerca avviata per: ${valoreCercato}`);
        home.innerHTML = `<h2 class="w-100 text-white p-3">Risultati per: "${valoreCercato}"</h2>`;
        const risultati = await fetchTracksByTerm(valoreCercato);
        renderRow("Canzoni trovate", risultati);
      }
    }
  });
}

loadHome();

//da qui lucio deve creare la funzione dei filtri e fargli un eventlistener
