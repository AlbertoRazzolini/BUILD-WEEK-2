/* ============================================================
   search.js — ricerca con debounce
   ============================================================

   COSA DEVI FARE
   1) initPage("search")
   2) Recupera l'ultima query da localStorage (STORAGE_KEY_LAST_SEARCH).
      Se presente, popola l'input e lancia la ricerca.
   3) Aggancia l'evento "input" all'input #search-input con debounce 400ms.
   4) doSearch(term):
      - se term è vuoto -> nascondi i 3 row e svuota i grid
      - altrimenti fetch in PARALLELO (Promise.all):
          - tracks   = search?term=...&entity=song&limit=12
          - albums   = search?term=...&entity=album&limit=8
          - artists  = search?term=...&entity=musicArtist&limit=8
      - mostra ciascuna sezione solo se i risultati sono > 0
      - salva l'ultima query in localStorage
   5) Per ogni risultato crea una card:
      - track  -> click = player.play(track)
      - album  -> click = window.location.href = "album.html?id=" + albumId
      - artist -> click = window.location.href = "artist.html?id=" + artistId
*/

const player = initPage("search");

const input        = document.querySelector("#search-input");
const rowTracks    = document.querySelector("#row-tracks");
const rowAlbums    = document.querySelector("#row-albums");
const rowArtists   = document.querySelector("#row-artists");
const gridTracks   = document.querySelector("#grid-tracks");
const gridAlbums   = document.querySelector("#grid-albums");
const gridArtists  = document.querySelector("#grid-artists");

const renderTrackCard  = (track)  => { /* TODO */ };
const renderAlbumCard  = (album)  => { /* TODO */ };
const renderArtistCard = (artist) => { /* TODO */ };

const doSearch = async (term) => {
  // TODO: implementare come da elenco sopra (Promise.all)
};

const debouncedSearch = debounce(doSearch, 400);

input.addEventListener("input", (event) => {
  debouncedSearch(event.target.value.trim());
});

// TODO: al caricamento, recupera l'ultima query da localStorage e lancia doSearch(lastQuery)
