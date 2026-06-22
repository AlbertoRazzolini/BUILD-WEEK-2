/* ============================================================
   common.js — codice condiviso tra tutte le pagine
   ============================================================

   REGOLE GENERALI
   - Solo const e let (mai var)
   - DOM: querySelector / querySelectorAll
   - Eventi: addEventListener (mai onclick inline)
   - fetch + async/await + try/catch
   - localStorage: setItem / getItem / removeItem (salva sempre stringhe)
   - Pattern OOP: classi Track, Album, Artist, Player

   COSA CONTIENE QUESTO FILE
   1) Costanti (URL base API, chiavi localStorage)
   2) Helpers (fetchJSON, formatTime, bigArt, debounce)
   3) Classi modello: Track, Album, Artist
   4) Classe Player (gestisce <audio>)
   5) localStorage helpers (history, favourites)
   6) Render sidebar e player footer
   7) Inizializzazione al DOMContentLoaded

   ESEMPIO USO DELL'ELEMENTO <audio>
   --------------------------------
     const audio = document.querySelector("#audio-element");
     audio.src = "https://...preview.m4a"; // URL della preview MP3
     audio.play();                         // avvia la riproduzione
     audio.pause();                        // mette in pausa
     audio.currentTime = 10;               // salta a 10 secondi
     audio.duration;                       // durata in secondi
     audio.volume = 0.5;                   // volume tra 0 e 1

     audio.addEventListener("timeupdate", () => {
       // chiamato continuamente durante la riproduzione
       const percent = (audio.currentTime / audio.duration) * 100;
     });

     audio.addEventListener("ended", () => {
       // brano finito
     });

   ESEMPIO USO DELL'API iTunes
   ---------------------------
     // Ricerca brani
     fetch("https://itunes.apple.com/search?term=eminem&entity=song&limit=10")

     // Ricerca album
     fetch("https://itunes.apple.com/search?term=pink+floyd&entity=album&limit=10")

     // Ricerca artisti
     fetch("https://itunes.apple.com/search?term=jovanotti&entity=musicArtist&limit=5")

     // Dettagli album (con tracce)
     fetch("https://itunes.apple.com/lookup?id=1440831203&entity=song")

     // Top tracks artista
     fetch("https://itunes.apple.com/lookup?id=909253&entity=song&limit=10")
*/

/* ============================ 1. Costanti ============================ */

const API_BASE = "https://itunes.apple.com";
const STORAGE_KEY_HISTORY = "epitunes_history";
const STORAGE_KEY_FAVOURITES = "epitunes_favourites";
const STORAGE_KEY_LAST_SEARCH = "epitunes_last_search";
const MAX_HISTORY = 12;

/* ============================ 2. Helpers ============================ */

/*
  fetchJSON(url)
  - Fa una richiesta GET e ritorna i dati JSON
  - Gestisce errori HTTP e di rete con try/catch
  - In caso di errore ritorna { results: [], resultCount: 0 } per semplificare i chiamanti
*/
const fetchJSON = async (url) => {
  // TODO: implementare con try/catch + await response.json()
  // - Se response.ok è false, lancia un Error
  // - Se la chiamata fallisce per rete, ritorna oggetto vuoto e logga l'errore
  return { results: [], resultCount: 0 };
};

/*
  bigArt(url)
  - L'API iTunes ritorna artwork 100x100 (artworkUrl100)
  - Sostituisce "100x100bb" con "600x600bb" per avere una cover più grande
*/
const bigArt = (url) => {
  if (!url) return "";
  return url.replace("100x100", "600x600");
};

/*
  formatTime(ms)
  - Converte millisecondi in stringa "m:ss"
  - Esempio: 65000 -> "1:05"
*/
const formatTime = (ms) => {
  if (!ms) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

/*
  debounce(fn, ms)
  - Restituisce una nuova funzione che chiama fn solo dopo "ms" millisecondi
    di pausa rispetto all'ultima chiamata. Usata per la ricerca al type.
*/
const debounce = (fn, ms) => {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), ms);
  };
};

/* ============================ 3. Classi modello ============================ */

/*
  Classe Track
  Modella un brano restituito dall'API iTunes (wrapperType === "track").
  Campi utili dell'API: trackId, trackName, artistName, collectionName,
  collectionId, artistId, artworkUrl100, previewUrl, trackTimeMillis.
*/
class Track {
  constructor(raw) {
    // TODO: assegna alle property di this i valori da raw
    // (id, title, artist, album, albumId, artistId, cover, previewUrl, durationMs)
  }
}

/*
  Classe Album
  Modella un album (wrapperType === "collection").
  Campi utili: collectionId, collectionName, artistName, artworkUrl100,
  releaseDate, trackCount.
*/
class Album {
  constructor(raw) {
    // TODO: come sopra
  }
}

/*
  Classe Artist
  Modella un artista (wrapperType === "artist").
  Campi utili: artistId, artistName, primaryGenreName.
*/
class Artist {
  constructor(raw) {
    // TODO: come sopra
  }
}

/* ============================ 4. Classe Player ============================ */

/*
  Classe Player
  Gestisce la riproduzione audio e la UI del player footer.

  Stato interno:
    - currentTrack: Track corrente (null se nessun brano)
    - isPlaying: true/false

  Metodi pubblici:
    - mount()        -> rende la UI del player nel footer (.player)
    - play(track)    -> imposta currentTrack, src audio, avvia, salva in history
    - togglePlay()   -> alterna play/pause sul brano corrente
    - setVolume(v)   -> v tra 0 e 1
    - seek(percent)  -> sposta currentTime a percent% della durata

  Eventi audio da agganciare:
    - "timeupdate" per aggiornare la progress bar
    - "ended" per fermarsi a fine brano
*/
class Player {
  constructor() {
    this.audio = document.querySelector("#audio-element");
    this.currentTrack = null;
    this.isPlaying = false;
    // TODO: salva i riferimenti agli elementi del footer (.player-cover, .player-title, ...)
    // TODO: aggancia eventi audio (timeupdate, ended)
  }

  mount() {
    const footer = document.querySelector(".player");
    if (!footer) return;
    footer.innerHTML = `
      <div class="player-track">
        <div class="player-cover"><img id="player-cover-img" alt="" /></div>
        <div class="player-meta">
          <p class="player-title" id="player-title">Seleziona un brano</p>
          <p class="player-artist" id="player-artist">—</p>
        </div>
      </div>

      <div class="player-center">
        <div class="player-controls">
          <button class="btn-ctrl" id="btn-shuffle" aria-label="Shuffle">⇄</button>
          <button class="btn-ctrl" id="btn-prev"    aria-label="Precedente">⏮</button>
          <button class="btn-play" id="btn-toggle"  aria-label="Play/Pausa">▶</button>
          <button class="btn-ctrl" id="btn-next"    aria-label="Successivo">⏭</button>
          <button class="btn-ctrl" id="btn-repeat"  aria-label="Ripeti">↻</button>
        </div>
        <div class="player-progress">
          <span id="time-current">0:00</span>
          <div class="progress-bar" id="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span id="time-total">0:00</span>
        </div>
      </div>

      <div class="player-right">
        <span>🔊</span>
        <div class="volume-bar" id="volume-bar">
          <div class="volume-fill" id="volume-fill" style="width: 80%"></div>
        </div>
      </div>
    `;

    // TODO: aggancia eventi click su #btn-toggle, click su #progress-bar (seek),
    //       click su #volume-bar (setVolume), volume iniziale (this.audio.volume = 0.8).
  }

  play(track) {
    // TODO:
    // 1) salva track in this.currentTrack
    // 2) this.audio.src = track.previewUrl
    // 3) this.audio.play()
    // 4) aggiorna UI (cover, titolo, artista, durata totale, icona play -> "⏸")
    // 5) chiama addToHistory(track)
    // 6) marca .track-row.is-playing se siamo nella tracklist
  }

  togglePlay() {
    // TODO: alterna play/pause + aggiorna icona del button
  }

  setVolume(v) {
    // TODO: this.audio.volume = v; aggiorna #volume-fill style.width
  }

  seek(percent) {
    // TODO: this.audio.currentTime = this.audio.duration * percent
  }
}

/* ============================ 5. localStorage helpers ============================ */

/*
  getHistory() -> array di Track (al più MAX_HISTORY)
  addToHistory(track) -> aggiunge in testa, rimuove duplicati, taglia a MAX_HISTORY
  getFavourites() -> array di Track
  isFavourite(trackId) -> bool
  toggleFavourite(track) -> aggiunge o rimuove
*/

const getHistory = () => {
  // TODO: leggi STORAGE_KEY_HISTORY, JSON.parse, ritorna array (vuoto se assente)
  return [];
};

const addToHistory = (track) => {
  // TODO: array = getHistory(); rimuovi eventuale duplicato (per id);
  //       metti track in testa; tronca a MAX_HISTORY; salva
};

const getFavourites = () => {
  // TODO: come getHistory ma con STORAGE_KEY_FAVOURITES
  return [];
};

const isFavourite = (trackId) => {
  // TODO: return getFavourites().some(t => t.id === trackId)
  return false;
};

const toggleFavourite = (track) => {
  // TODO: se presente per id -> rimuovi; altrimenti aggiungi in testa; salva
};

/* ============================ 6. Render sidebar ============================ */

/*
  renderSidebar(activePage)
  - activePage: "home" | "search" | "library" (per evidenziare il link attivo)
*/
const renderSidebar = (activePage) => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="brand">
      <div class="brand-mark">E</div>
      <span class="brand-text">EpiTunes</span>
    </div>
    <nav class="sidebar-nav">
      <a href="index.html"  data-page="home"   ${activePage === "home"   ? 'class="active"' : ""}><span class="ico">🏠</span><span>Home</span></a>
      <a href="search.html" data-page="search" ${activePage === "search" ? 'class="active"' : ""}><span class="ico">🔍</span><span>Cerca</span></a>
    </nav>
    <p class="sidebar-section-title">I tuoi preferiti</p>
    <ul class="sidebar-list" id="sidebar-favs"></ul>
  `;
  // TODO (opzionale): popola #sidebar-favs con i titoli dei preferiti
};

/* ============================ 7. Inizializzazione ============================ */

/*
  initPage(activePage)
  - Chiamata da home.js / search.js / album.js / artist.js
  - Monta sidebar, monta player, restituisce il player per essere usato.
*/
const initPage = (activePage) => {
  renderSidebar(activePage);
  const player = new Player();
  player.mount();
  window.player = player;
  return player;
};
