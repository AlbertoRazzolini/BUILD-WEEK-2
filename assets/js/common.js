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
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("fetchJSON ha fallito:", error)
  }
  return { results: [], resultCount: 0 };
};
  // TODO: implementare con try/catch + await response.json()
  // - Se response.ok è false, lancia un Error
  // - Se la chiamata fallisce per rete, ritorna oggetto vuoto e logga l'errore
  

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

/* ============================ 2.5 Funzioni ========================== */


// qui gestisco i miei badge filtro: invece di cercare su iTunes,
// faccio vedere i miei preferiti salvati divisi per tipo.
// siccome salvo sempre brani, ricavo album e artisti da quelli.
// li ho fatti funzionare come su Spotify: ricliccando lo stesso
// filtro torno alla normalità, e ne tengo attivo solo uno alla volta.
let filtroActivo = null;

const myFunction = () => {
  const myButtons = document.querySelectorAll(".badge.bg-secondary");
  if (myButtons.length === 0) return;

  const contenedor = document.getElementById("sidebar-filter-results");

  // mi svuota la lista e spegne il verde da tutti i badge
  const resetFiltros = () => {
    filtroActivo = null;
    if (contenedor) contenedor.replaceChildren();
    myButtons.forEach((b) => {
      b.classList.remove("bg-success");
      b.classList.add("bg-secondary");
    });
  };

  myButtons.forEach((singleButton) => {
    singleButton.addEventListener("click", (event) => {
      const filtro = event.currentTarget.dataset.filter;

      // se riclicco il filtro che ho già attivo, lo spengo e torno normale
      if (filtroActivo === filtro) {
        resetFiltros();
        return;
      }

      // accendo questo filtro e spengo gli altri, poi lo coloro di verde
      resetFiltros();
      filtroActivo = filtro;
      event.currentTarget.classList.remove("bg-secondary");
      event.currentTarget.classList.add("bg-success");

      const favourites = getFavourites();

      if (filtro === "artisti") {
        // tengo un artista solo per ogni artistId così non li ripeto
        const mapaArtistas = new Map();
        favourites.forEach((track) => {
          if (!mapaArtistas.has(track.artistId)) {
            mapaArtistas.set(track.artistId, {
              id: track.artistId,
              title: track.artist,
            });
          }
        });
        renderResultados([...mapaArtistas.values()], "artisti");

      } else if (filtro === "album") {
        // stessa cosa per gli album: uno solo per ogni albumId
        const mapaAlbums = new Map();
        favourites.forEach((track) => {
          if (!mapaAlbums.has(track.albumId)) {
            mapaAlbums.set(track.albumId, {
              id: track.albumId,
              title: track.album,
              artist: track.artist,
              cover: track.cover,
            });
          }
        });
        renderResultados([...mapaAlbums.values()], "album");

      } else if (filtro === "generi") {
        // raggruppo per genere: un genere solo anche se ho più brani uguali
        const mapaGeneros = new Map();
        favourites.forEach((track) => {
          const genero = track.genre || "Sconosciuto";
          if (!mapaGeneros.has(genero)) {
            mapaGeneros.set(genero, { id: genero, title: genero });
          }
        });
        renderResultados([...mapaGeneros.values()], "generi");
      }
    });
  });
};

// questa la uso per disegnare i risultati dentro #sidebar-filter-results.
// clono il <template> giusto in base al tipo, come faccio già per i preferiti.
const renderResultados = (lista, tipo) => {
  const contenedor = document.getElementById("sidebar-filter-results");
  if (!contenedor) return;

  // scelgo il template a seconda di cosa devo mostrare
  let tmpl = null;
  if (tipo === "album") {
    tmpl = document.getElementById("tmpl-album-item");
  } else if (tipo === "artisti") {
    tmpl = document.getElementById("tmpl-artist-item");
  } else if (tipo === "generi") {
    tmpl = document.getElementById("tmpl-filter-result");
  }
  if (!tmpl) return;
   //skibidi
  // per ogni elemento clono il template e ci metto dentro i suoi dati
  const buildItem = (elemento) => {
    const item = tmpl.content.firstElementChild.cloneNode(true);

    if (tipo === "album") {
      const img = item.querySelector(".album-cover");
      if (img) {
        img.src = elemento.cover || "https://placehold.co/40x40";
        img.alt = elemento.title;
      }
      item.querySelector(".album-title").textContent = elemento.title;
      item.querySelector(".album-artist").textContent = elemento.artist;
      // cliccando l'album mi porto sulla pagina dell'album
      item.addEventListener("click", () => {
        window.location.href = `album.html?id=${elemento.id}`;
      });
    } else if (tipo === "artisti") {
      const img = item.querySelector(".artist-cover");
      if (img) img.alt = elemento.title;
      item.querySelector(".artist-name").textContent = elemento.title;
      // cliccando l'artista vado sulla sua pagina
      item.addEventListener("click", () => {
        window.location.href = `artist.html?id=${elemento.id}`;
      });
    } else if (tipo === "generi") {
      // qui elemento è un genere, quindi mostro solo il suo nome
      const ico = item.querySelector(".ico");
      if (ico) ico.textContent = "🎵";
      item.querySelector(".filter-label").textContent = elemento.title;
    }

    return item;
  };

  // svuoto e rimetto dentro tutti i nuovi elementi
  contenedor.replaceChildren(...lista.map(buildItem));
};

/* ============================ 3. Classi modello ============================ */

/*
  Classe Track
  Modella un brano restituito dall'API iTunes (wrapperType === "track").
  Campi utili dell'API: trackId, trackName, artistName, collectionName,
  collectionId, artistId, artworkUrl100, previewUrl, trackTimeMillis.
*/
//skybidi
//cosa prendere dall API per ogni singolo brano (chiamando con il this)
class Track {
  constructor(raw) {
    this.id = raw.trackId; //ID
    this.title = raw.trackName; //nome traccia
    this.artist = raw.artistName;//nome artista
    this.album = raw.collectionName;//nome album
    this.albumId = raw.collectionId;//ID album
    this.artistId = raw.artistId;//ID artista
    this.cover = raw.artworkUrl100;//link immagine copertina
    this.previewUrl = raw.previewUrl;//link streaming di 30 secondi
    this.durationMs = raw.trackTimeMillis;//durata in millisecondi
    this.genre = raw.primaryGenreName;//genere del brano (mi serve per il filtro Generi)
  }
}

class Album {
  constructor(raw) {
    this.id = raw.collectionId;//ID album
    this.title = raw.collectionName;//nome album
    this.artist = raw.artistName;//chi è l'artista
    this.cover = raw.artworkUrl100;//cover album
    this.releaseDate = raw.releaseDate;//data di uscita
    this.trackCount = raw.trackCount;//numero di tracce incluse
  }
}

class Artist {
  constructor(raw) {
    this.id = raw.artistId;//ID artista
    this.name = raw.artistName;//nome artista
    this.genre = raw.primaryGenreName;//genere musicale di questa traccia
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
    this.audio = document.querySelector("#audio-element");//recupera tag audio a riga circa 225
    this.currentTrack = null;//brano iniziale : nessuno
    this.isPlaying = false;//riproduzione iniziale : nessuno

    if (this.audio) {//attivalo durante tutta la durata del brano
      this.audio.addEventListener("timeupdate", () => {
        if (!this.audio.duration) return;//non attivarti se non ce nessun branp
        const currentEl = document.getElementById("time-current");//seleziona testo tempo corrente a sinistra
        const fillEl = document.getElementById("progress-fill");//seleziona barra progresso
        if (currentEl) {//trasforma il vero tempo in formato da spotify
          currentEl.textContent = formatTime(this.audio.currentTime * 1000);
        }
        if (fillEl) {//ascolta il vero avanzamento del brano e riempi la barra progresso
          const percent = (this.audio.currentTime / this.audio.duration) * 100;
          fillEl.style.width = `${percent}%`;
        }
      });
//cosa succede qudnado il brano finisce
      this.audio.addEventListener("ended", () => {
        this.isPlaying = false;//non in riproduzione
        const btnToggle = document.getElementById("btn-toggle");//prendi il pulsante play
        if (btnToggle) btnToggle.textContent = "▶";//rimetti icona play al posto di pausa
      });
    }
  }
//TUTTO L'HTML CHE CI SERVE NEL NOSTRO PLAYER/FOOTER
  mount() {
    const footer = document.querySelector(".player");
    if (!footer) return;
    //struttura spotify

    const coverImg = document.createElement("img");
    coverImg.id = "player-cover-img";
    coverImg.alt = "";
    const cover = document.createElement("div");
    cover.className = "player-cover";
    cover.appendChild(coverImg);

    const title = document.createElement("p");
    title.className = "player-title";
    title.id = "player-title";
    title.textContent = "Seleziona un brano";

    const artist = document.createElement("p");
    artist.className = "player-artist";
    artist.id = "player-artist";
    artist.textContent = "—";

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.append(title, artist);

    const track = document.createElement("div");
    track.className = "player-track";
    track.append(cover, meta);

    const btnShuffle = document.createElement("button");
    btnShuffle.className = "btn-ctrl";
    btnShuffle.id = "btn-shuffle";
    btnShuffle.setAttribute("aria-label", "Shuffle");
    btnShuffle.textContent = "⇄";

    const btnPrev = document.createElement("button");
    btnPrev.className = "btn-ctrl";
    btnPrev.id = "btn-prev";
    btnPrev.setAttribute("aria-label", "Precedente");
    btnPrev.textContent = "⏮";

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn-play";
    btnToggle.id = "btn-toggle";
    btnToggle.setAttribute("aria-label", "Play/Pausa");
    btnToggle.textContent = "▶";

    const btnNext = document.createElement("button");
    btnNext.className = "btn-ctrl";
    btnNext.id = "btn-next";
    btnNext.setAttribute("aria-label", "Successivo");
    btnNext.textContent = "⏭";

    const btnRepeat = document.createElement("button");
    btnRepeat.className = "btn-ctrl";
    btnRepeat.id = "btn-repeat";
    btnRepeat.setAttribute("aria-label", "Ripeti");
    btnRepeat.textContent = "↻";

    const controls = document.createElement("div");
    controls.className = "player-controls";
    controls.append(btnShuffle, btnPrev, btnToggle, btnNext, btnRepeat);

    const timeCurrent = document.createElement("span");
    timeCurrent.id = "time-current";
    timeCurrent.textContent = "0:00";

    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressFill.id = "progress-fill";

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.id = "progress-bar";
    progressBar.appendChild(progressFill);

    const timeTotal = document.createElement("span");
    timeTotal.id = "time-total";
    timeTotal.textContent = "0:00";

    const progress = document.createElement("div");
    progress.className = "player-progress";
    progress.append(timeCurrent, progressBar, timeTotal);

    const center = document.createElement("div");
    center.className = "player-center";
    center.append(controls, progress);

    const volumeIcon = document.createElement("span");
    volumeIcon.textContent = "🔊";

    const volumeFill = document.createElement("div");
    volumeFill.className = "volume-fill";
    volumeFill.id = "volume-fill";
    volumeFill.style.width = "80%";

    const volumeBar = document.createElement("div");
    volumeBar.className = "volume-bar";
    volumeBar.id = "volume-bar";
    volumeBar.appendChild(volumeFill);

    const right = document.createElement("div");
    right.className = "player-right";
    right.append(volumeIcon, volumeBar);

    footer.replaceChildren(track, center, right);

    if (this.audio) {//volume di defalut all 80 %
      this.audio.volume = 0.8;
    }

    btnToggle.addEventListener("click", () => this.togglePlay());//dai un listener al bottone play /pause

    progressBar.addEventListener("click", (e) => {//listener per il click della barra del progresso della canzone
      if (!this.currentTrack || !this.audio.duration) return;
      const rect = progressBar.getBoundingClientRect();//dammi le coordinate della barra
      const clickX = e.clientX - rect.left;//calcola dove ho toccato esattamente
      const width = rect.width;//larghezza totale barra
      const percent = clickX / width;//trasforma il click in percentuale
      this.seek(percent);//sposta la riproduzione a quella percentuale
    });

    volumeBar.addEventListener("click", (e) => {//listener della barra del volume
      const rect = volumeBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;//sempre tra 0 e 1 massimo
      const percent = Math.max(0, Math.min(1, clickX / width));
      this.setVolume(percent);//applica il nuovo volume
    });
  }
//ricevi il tarck di Apple e riproducilo
  play(track) {
    if (!track || !track.previewUrl) return;
    this.currentTrack = track;
    this.audio.src = track.previewUrl;
    this.audio.play();
    this.isPlaying = true;
//aggiorna tutta linterfaccia del footer con i nuovi dati del API della canzone da ascoltare
    const coverImg = document.getElementById("player-cover-img");
    const titleEl = document.getElementById("player-title");
    const artistEl = document.getElementById("player-artist");
    const totalEl = document.getElementById("time-total");
    const btnToggle = document.getElementById("btn-toggle");

    if (coverImg) coverImg.src = track.cover;
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (totalEl) totalEl.textContent = formatTime(track.durationMs);
    if (btnToggle) btnToggle.textContent = "⏸";

    if (typeof addToHistory === "function") {
      addToHistory(track);
    }
  }
//comportamento del toggle delbottone play /pause
  togglePlay() {
    if (!this.currentTrack) return;
    const btnToggle = document.getElementById("btn-toggle");
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      if (btnToggle) btnToggle.textContent = "▶";
    } else {
      this.audio.play();
      this.isPlaying = true;
      if (btnToggle) btnToggle.textContent = "⏸";
    }
  }
//regola volume sempre tran 0 e 1
  setVolume(v) {
    if (!this.audio) return;
    this.audio.volume = v;
    const volumeFill = document.getElementById("volume-fill");
    if (volumeFill) {
      volumeFill.style.width = `${v * 100}%`;
    }
  }

  seek(percent) {
    if (!this.audio || !this.audio.duration) return;
    this.audio.currentTime = percent * this.audio.duration;
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
  const historyData = localStorage.getItem(STORAGE_KEY_HISTORY);
  return historyData ? JSON.parse(historyData) : [];

};

const addToHistory = (track) => {
  let history = getHistory();

  history = history.filter(t => t.id !== track.id);

  history.unshift(track);

  if(history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
 
};
  // TODO: come getHistory ma con STORAGE_KEY_FAVOURITES
const getFavourites = () => {
  const favouritesData = localStorage.getItem(STORAGE_KEY_FAVOURITES);
  return favouritesData ? JSON.parse(favouritesData) : [];

  
};
// TODO: return getFavourites().some(t => t.id === trackId)
const isFavourite = (trackId) => {
  return getFavourites().some(t => t.id === trackId);
};
// TODO: se presente per id -> rimuovi; altrimenti aggiungi in testa; salva
const toggleFavourite = (track) => {
  let favourites = getFavourites();
  const exists = favourites.some(t => t.id === track.id);

  if(exists){
    favourites = favourites.filter(t => t.id !== track.id);
  }else{
    favourites.unshift(track);
  }

  localStorage.setItem(STORAGE_KEY_FAVOURITES, JSON.stringify(favourites));

  renderSidebarFavourites();
};

/* ============================ 6. Render sidebar ============================ */

/*
  renderSidebarFavourites()
  - Popola #sidebar-favs-list (desktop) e #mobile-favs-list (offcanvas mobile)
    clonando #tmpl-fav-item per ciascun preferito.
  - Se non ci sono preferiti, mostra il placeholder "Nessuno ancora".
*/
const renderSidebarFavourites = () => {
  const tmplFav = document.getElementById("tmpl-fav-item");
  const lists = document.querySelectorAll("#sidebar-favs-list, #mobile-favs-list");
  if (!tmplFav || lists.length === 0) return;

  const favourites = getFavourites();

  const buildEmptyItem = () => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "dropdown-item text-secondary";
    span.textContent = "Nessuno ancora";
    li.appendChild(span);
    return li;
  };

  const buildFavItem = (track) => {
    const item = tmplFav.content.firstElementChild.cloneNode(true);
    const img = item.querySelector(".fav-cover");
    img.src = track.cover;
    img.alt = track.title;
    item.querySelector(".fav-title").textContent = track.title;
    item.querySelector(".fav-artist").textContent = track.artist;
    item.addEventListener("click", () => {
      if (window.player) window.player.play(track);
    });
    return item;
  };

  lists.forEach((list) => {
    list.replaceChildren(
      ...(favourites.length > 0 ? favourites.map(buildFavItem) : [buildEmptyItem()]),
    );
  });
};

/*
  renderSidebar(activePage)
  - activePage: "home" | "search" | "library" (per evidenziare il link attivo)

const renderSidebar = (activePage) => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="brand">
      <div class="brand-mark">E</div>
      <span class="brand-text">EpiTunes</span>
    </div>
    <nav class="sidebar-nav">
      <a href="index.html"  data-page="home"   ${activePage === "home" ? 'class="active"' : ""}><span class="ico">🏠</span><span>Home</span></a>
      <a href="search.html" data-page="search" ${activePage === "search" ? 'class="active"' : ""}><span class="ico">🔍</span><span>Cerca</span></a>
    </nav>
    <p class="sidebar-section-title">I tuoi preferiti</p>
    <ul class="sidebar-list" id="sidebar-favs"></ul>
  `;
  // TODO (opzionale): popola #sidebar-favs con i titoli dei preferiti
};
*/
/* ============================ 7. Inizializzazione ============================ */

/*
  initPage(activePage)
  - Chiamata da home.js / search.js / album.js / artist.js
  - Monta il player nel footer e lo restituisce per essere usato.
  - renderSidebar() rimossa: la sidebar è ora statica in HTML su ogni pagina.
    La classe "active" è hardcodata per pagina, i preferiti/playlist
    vengono popolati via cloneNode da Simo/Cris direttamente sugli id HTML.
*/
const initPage = (activePage) => {
  const player = new Player();
  player.mount();

  window.player = player;

  renderSidebarFavourites();

  // attivo i miei badge filtro (altrimenti i bottoni non fanno niente)
  myFunction();

  return player;
};

