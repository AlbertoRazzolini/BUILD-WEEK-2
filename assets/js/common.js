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
const STORAGE_KEY_PLAYLIST = "epitunes_playlist"; // singola playlist (migrazione) — Lucio legge questa chiave per i container playlist
const STORAGE_KEY_PLAYLISTS = "epitunes_playlists"; // playlist multiple con nome — struttura: [{id, name, tracks}]
const STORAGE_KEY_LAST_SEARCH = "epitunes_last_search";
const STORAGE_KEY_VOLUME = "epitunes_volume"; // volume salvato tra sessioni (Cris)
const STORAGE_KEY_SHUFFLE = "epitunes_shuffle";
const STORAGE_KEY_REPEAT = "epitunes_repeat";
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
    console.error("fetchJSON ha fallito:", error);
  }
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

/* ============================ 2.5 Funzioni ========================== */

// qui gestisco i miei badge filtro: invece di cercare su iTunes,
// faccio vedere i miei preferiti salvati divisi per tipo.
// siccome salvo sempre brani, ricavo album e artisti da quelli.
// li ho fatti funzionare come su Spotify: ricliccando lo stesso
// filtro torno alla normalità, e ne tengo attivo solo uno alla volta.
let filtroActivo = null;
let filtroGeneroActivo = null; // genere selezionato nella lista — persiste tra re-render

// costruisce e renderizza la lista dei generi dai preferiti attuali
const renderGenreFilter = () => {
  const mapaGeneros = new Map();
  getFavourites().forEach((track) => {
    const genero = track.genre || "Sconosciuto";
    if (!mapaGeneros.has(genero)) {
      mapaGeneros.set(genero, { id: genero, title: genero });
    }
  });
  renderResultados([...mapaGeneros.values()], "generi");

  // riapplica l'evidenziazione del genere attivo dopo il re-render
  if (filtroGeneroActivo) {
    const contenedor = document.getElementById("sidebar-filter-results");
    if (contenedor) {
      contenedor.querySelectorAll(".sidebar-filter-item").forEach((el) => {
        if (el.querySelector(".filter-label")?.textContent === filtroGeneroActivo) {
          el.classList.add("active-genre");
        }
      });
    }
  }
};

const myFunction = () => {
  const myButtons = document.querySelectorAll(".badge.bg-secondary");
  if (myButtons.length === 0) return;

  const contenedor = document.getElementById("sidebar-filter-results");

  // mi svuota la lista e spegne il verde da tutti i badge
  const resetFiltros = () => {
    filtroActivo = null;
    filtroGeneroActivo = null;
    if (contenedor) contenedor.replaceChildren();
    myButtons.forEach((b) => {
      b.classList.remove("bg-success");
      b.classList.add("bg-secondary");
    });
    // ripristina card, sezioni e preferiti sidebar nascosti dal filtro generi
    document.querySelectorAll(".card[data-genre]").forEach((c) => (c.style.display = ""));
    document.querySelectorAll("#sidebar-favs-list [data-genre], #mobile-favs-list [data-genre]").forEach((item) => item.classList.remove("genre-hidden"));
    [
      "row-history",
      "row-favourites",
      "row-pop",
      "row-rock",
      "row-hits",
    ].forEach((id) => {
      const section = document.getElementById(id);
      if (section) section.style.display = "";
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
              cover: track.cover, // MARCO - aggiungo track.cover per selezionare anche l'immagine
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
        renderGenreFilter();
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
        img.src = elemento.cover || "";
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
      // if (img) img.alt = elemento.title;
      if (img) {
        // MARCO - così facendo diciamo all'immagine quale foto caricare
        img.src = elemento.cover || "";
        img.alt = elemento.title;
      }
      item.querySelector(".artist-name").textContent = elemento.title;
      // cliccando l'artista vado sulla sua pagina
      item.addEventListener("click", () => {
        window.location.href = `artist.html?id=${elemento.id}`;
      });
    } else if (tipo === "generi") {
      const ico = item.querySelector(".ico");
      if (ico) ico.textContent = "🎵";
      item.querySelector(".filter-label").textContent = elemento.title;
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        // salva e evidenzia il genere attivo, toglie l'attivo dagli altri
        filtroGeneroActivo = elemento.title;
        contenedor
          .querySelectorAll(".sidebar-filter-item")
          .forEach((el) => el.classList.remove("active-genre"));
        item.classList.add("active-genre");
        // filtra le card della home e i preferiti in sidebar per genere
        const genreLower = elemento.title.toLowerCase();
        document.querySelectorAll(".card[data-genre]").forEach((card) => {
          card.style.display = card.dataset.genre.includes(genreLower) ? "" : "none";
        });
        document.querySelectorAll("#sidebar-favs-list [data-genre], #mobile-favs-list [data-genre]").forEach((item) => {
          const g = item.dataset.genre;
          item.classList.toggle("genre-hidden", !!(g && !g.includes(genreLower)));
        });
        // nasconde le sezioni della home che non hanno più card visibili
        [
          "row-ai",
          "row-history",
          "row-favourites",
          "row-pop",
          "row-rock",
          "row-hits",
        ].forEach((id) => {
          const section = document.getElementById(id);
          if (!section) return;
          const hasVisible = [...section.querySelectorAll(".card")].some(
            (c) => c.style.display !== "none",
          );
          section.style.display = hasVisible ? "" : "none";
        });
      });
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
    this.artist = raw.artistName; //nome artista
    this.album = raw.collectionName; //nome album
    this.albumId = raw.collectionId; //ID album
    this.artistId = raw.artistId; //ID artista
    this.cover = raw.artworkUrl100; //link immagine copertina
    this.previewUrl = raw.previewUrl; //link streaming di 30 secondi
    this.durationMs = raw.trackTimeMillis; //durata in millisecondi
    this.genre = raw.primaryGenreName; //genere del brano (mi serve per il filtro Generi)
  }
}

class Album {
  constructor(raw) {
    this.id = raw.collectionId; //ID album
    this.title = raw.collectionName; //nome album
    this.artist = raw.artistName; //chi è l'artista
    this.artistId = raw.artistId; //ID artista (per link pagina artista)
    this.cover = raw.artworkUrl100; //cover album
    this.releaseDate = raw.releaseDate; //data di uscita
    this.trackCount = raw.trackCount; //numero di tracce incluse
  }
}

class Artist {
  constructor(raw) {
    this.id = raw.artistId; //ID artista
    this.name = raw.artistName; //nome artista
    this.genre = raw.primaryGenreName; //genere musicale di questa traccia
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
    this.audio = document.querySelector("#audio-element"); //recupera tag audio a riga circa 225
    this.currentTrack = null; //brano iniziale : nessuno
    this.isPlaying = false; //riproduzione iniziale : nessuno

    // Stato per Shuffle e Repeat — ripristinato da localStorage per restare attivo tra una pagina e l'altra
    this.currentTracklist = [];
    this.isShuffle = localStorage.getItem(STORAGE_KEY_SHUFFLE) === "true";
    this.isRepeat = localStorage.getItem(STORAGE_KEY_REPEAT) === "true";
    this.shufflePool = [];

    // volume da ripristinare quando si disattiva il muto
    this.volumeBeforeMute = 0.5;

    if (!this.audio) return;

    this.audio.loop = this.isRepeat;

    // Listener per aggiornare la barra del tempo
    this.audio.addEventListener("timeupdate", () => {
      if (!this.audio.duration) return;
      const currentEl = document.getElementById("time-current");
      const fillEl = document.getElementById("progress-fill");
      if (currentEl) {
        currentEl.textContent = formatTime(this.audio.currentTime * 1000);
      }
      if (fillEl) {
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        fillEl.style.width = `${percent}%`;
      }
    });

    // Gestione automatica a fine canzone — in home mostra i consigli AI se pronti
    this.audio.addEventListener("ended", () => {
      const siamoInHome = document.getElementById("row-ai") !== null;

      if (
        siamoInHome &&
        consigliInBackground &&
        consigliInBackground.tracce &&
        consigliInBackground.tracce.length > 0
      ) {
        mostraConsigliSbloccati();
        return;
      }

      if (this.currentTracklist.length > 1) {
        this.next();
      } else {
        this.isPlaying = false;
        const btnToggle = document.getElementById("btn-toggle");
        if (btnToggle) btnToggle.textContent = "▶";
        this.updateNowPlayingUI();
      }
    });
  }
  //TUTTO L'HTML CHE CI SERVE NEL NOSTRO PLAYER/FOOTER
  mount() {
    const footer = document.querySelector(".player");
    if (!footer) return;

    // --- Costruzione UI (come l'originale) ---
    const coverImg = document.createElement("img");
    coverImg.id = "player-cover-img";
    coverImg.alt = "";
    const cover = document.createElement("div");
    cover.classList.add("player-cover");
    cover.appendChild(coverImg);

    // <a> invece di <p>: play() imposta href verso album.html / artist.html al cambio brano
    const title = document.createElement("a");
    title.className = "player-title";
    title.id = "player-title";
    title.textContent = "Seleziona un brano";

    const artist = document.createElement("a");
    artist.className = "player-artist";
    artist.id = "player-artist";
    artist.textContent = "—";

    const meta = document.createElement("div");
    meta.classList.add("player-meta");
    meta.append(title, artist);

    const track = document.createElement("div");
    track.classList.add("player-track");
    track.append(cover, meta);

    const btnShuffle = document.createElement("button");
    btnShuffle.classList.add("btn-ctrl");
    btnShuffle.id = "btn-shuffle";
    btnShuffle.setAttribute("aria-label", "Shuffle");
    btnShuffle.textContent = "⇄";
    btnShuffle.style.color = this.isShuffle ? "#1db954" : ""; // riflette lo stato ripristinato da localStorage

    const btnPrev = document.createElement("button");
    btnPrev.classList.add("btn-ctrl");
    btnPrev.id = "btn-prev";
    btnPrev.setAttribute("aria-label", "Precedente");
    btnPrev.textContent = "⏮";

    const btnToggle = document.createElement("button");
    btnToggle.classList.add("btn-play");
    btnToggle.id = "btn-toggle";
    btnToggle.setAttribute("aria-label", "Play/Pausa");
    btnToggle.textContent = "▶";

    const btnNext = document.createElement("button");
    btnNext.classList.add("btn-ctrl");
    btnNext.id = "btn-next";
    btnNext.setAttribute("aria-label", "Successivo");
    btnNext.textContent = "⏭";

    const btnRepeat = document.createElement("button");
    btnRepeat.classList.add("btn-ctrl");
    btnRepeat.id = "btn-repeat";
    btnRepeat.setAttribute("aria-label", "Ripeti");
    btnRepeat.textContent = "↻";
    btnRepeat.style.color = this.isRepeat ? "#1db954" : ""; // riflette lo stato ripristinato da localStorage

    const controls = document.createElement("div");
    controls.classList.add("player-controls");
    controls.append(btnShuffle, btnPrev, btnToggle, btnNext, btnRepeat);

    const timeCurrent = document.createElement("span");
    timeCurrent.id = "time-current";
    timeCurrent.textContent = "0:00";

    const progressFill = document.createElement("div");
    progressFill.classList.add("progress-fill");
    progressFill.id = "progress-fill";

    const progressBar = document.createElement("div");
    progressBar.classList.add("progress-bar");
    progressBar.id = "progress-bar";
    progressBar.appendChild(progressFill);

    const timeTotal = document.createElement("span");
    timeTotal.id = "time-total";
    timeTotal.textContent = "0:00";

    const progress = document.createElement("div");
    progress.classList.add("player-progress");
    progress.append(timeCurrent, progressBar, timeTotal);

    const center = document.createElement("div");
    center.classList.add("player-center");
    center.append(controls, progress);

    const volumeIcon = document.createElement("button");
    volumeIcon.classList.add("btn-ctrl");
    volumeIcon.id = "btn-mute";
    volumeIcon.setAttribute("aria-label", "Muto");
    volumeIcon.textContent = "🔊";

    const volumeFill = document.createElement("div");
    volumeFill.classList.add("volume-fill");
    volumeFill.id = "volume-fill";
    volumeFill.style.width = "80%";

    const volumeBar = document.createElement("div");
    volumeBar.classList.add("volume-bar");
    volumeBar.id = "volume-bar";
    volumeBar.appendChild(volumeFill);

    const right = document.createElement("div");
    right.classList.add("player-right");
    right.append(volumeIcon, volumeBar);

    footer.replaceChildren(track, center, right);

    if (this.audio) {
      const savedVolume = parseFloat(localStorage.getItem(STORAGE_KEY_VOLUME));
      const initialVolume = Number.isNaN(savedVolume)
        ? 0.5
        : Math.max(0, Math.min(1, savedVolume));
      this.setVolume(initialVolume);
    }

    btnToggle.addEventListener("click", () => this.togglePlay()); //dai un listener al bottone play /pause

    //percentuale (0-1) del punto orizzontale cliccato/trascinato dentro la barra
    const percentFromEvent = (bar, e) => {
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };

    let isDraggingProgress = false;
    const updateProgress = (e) => {
      if (!this.currentTrack || !this.audio.duration) return;
      const percent = percentFromEvent(progressBar, e);
      progressFill.style.width = `${percent * 100}%`; //feedback visivo immediato durante il trascinamento
      this.seek(percent);
    };
    progressBar.addEventListener("mousedown", (e) => {
      isDraggingProgress = true;
      updateProgress(e);
    });

    let isDraggingVolume = false;
    const updateVolume = (e) => {
      this.setVolume(percentFromEvent(volumeBar, e));
    };
    volumeBar.addEventListener("mousedown", (e) => {
      isDraggingVolume = true;
      updateVolume(e);
    });

    //il trascinamento continua anche se il mouse esce dai confini della barra
    document.addEventListener("mousemove", (e) => {
      if (isDraggingProgress) updateProgress(e);
      if (isDraggingVolume) updateVolume(e);
    });
    document.addEventListener("mouseup", () => {
      isDraggingProgress = false;
      isDraggingVolume = false;
    });

    // bottone muto: clicca l'icona del volume per silenziare/ripristinare
    volumeIcon.addEventListener("click", () => this.toggleMute());

    // listener per i controlli di navigazione (prev/next/shuffle/repeat)
    btnPrev.addEventListener("click", () => this.prev());
    btnNext.addEventListener("click", () => this.next());
    btnShuffle.addEventListener("click", () => this.toggleShuffle());
    btnRepeat.addEventListener("click", () => this.toggleRepeat());
  }
  //ricevi il track di Apple e riproducilo; tracklist opzionale per next/prev
  play(track, tracklist = []) {
    if (!track || !track.previewUrl) return;
    this.currentTrack = track;
    if (tracklist.length > 0) this.currentTracklist = tracklist;
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
    if (titleEl) {
      titleEl.textContent = track.title;
      titleEl.href = `album.html?id=${track.albumId}`; // titolo footer → pagina album
    }
    if (artistEl) {
      artistEl.textContent = track.artist;
      artistEl.href = `artist.html?id=${track.artistId}`; // artista footer → pagina artista
    }
    if (totalEl) totalEl.textContent = formatTime(track.durationMs);
    if (btnToggle) btnToggle.textContent = "⏸";

    if (typeof addToHistory === "function") {
      addToHistory(track);
    }

    const footer = document.querySelector(".player");
    if (footer) footer.classList.add("has-track");

    this.updateNowPlayingUI();

    const btnAI = document.getElementById("btn-genera-ai");
    ottieniSuggerimentiAI(this.currentTrack, btnAI);
  }
  //comportamento del toggle delbottone play /pause
  togglePlay() {
    // Se non c'è nessuna canzone caricata, non fa nulla
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
    this.updateNowPlayingUI();
  }

  // .card-play può contenere testo semplice (search.js) o un <ion-icon> (card clonate da #tmpl-card in home.js):
  // gestisce entrambi i casi invece di sovrascrivere sempre con textContent
  setCardPlayIcon(btnPlay, isPlaying) {
    const icon = btnPlay.querySelector("ion-icon");
    if (icon) {
      icon.setAttribute("name", isPlaying ? "pause-outline" : "play-outline");
    } else {
      btnPlay.textContent = isPlaying ? "⏸" : "▶";
    }
  }

  // evidenzia in verde la riga/card del brano corrente e mostra ▶/⏸ su tutte le sue card
  // (querySelectorAll anche per le card: lo stesso brano può comparire in più righe della Home)
  updateNowPlayingUI() {
    document.querySelectorAll(".track-row.is-playing").forEach((el) => {
      el.classList.remove("is-playing");
    });
    document.querySelectorAll(".card-play.is-playing").forEach((el) => {
      el.classList.remove("is-playing");
      this.setCardPlayIcon(el, false);
    });

    if (!this.currentTrack) return;

    document
      .querySelectorAll(`.track-row[data-id="${this.currentTrack.id}"]`)
      .forEach((el) => el.classList.add("is-playing"));

    document
      .querySelectorAll(`.card[data-id="${this.currentTrack.id}"] .card-play`)
      .forEach((btnPlay) => {
        btnPlay.classList.add("is-playing");
        this.setCardPlayIcon(btnPlay, this.isPlaying);
      });
  }
  //regola volume sempre tran 0 e 1
  setVolume(v) {
    if (!this.audio) return;
    this.audio.volume = v;
    // ricorda l'ultimo volume non-zero anche se cambiato trascinando la barra (non solo dal bottone muto)
    if (v > 0) this.volumeBeforeMute = v;
    const volumeFill = document.getElementById("volume-fill");
    if (volumeFill) {
      volumeFill.style.width = `${v * 100}%`;
    }
    const muteBtn = document.getElementById("btn-mute");
    if (muteBtn) {
      muteBtn.textContent = v === 0 ? "🔇" : v < 0.5 ? "🔉" : "🔊";
    }
    localStorage.setItem(STORAGE_KEY_VOLUME, v.toString());
  }

  //silenzia il volume salvando il valore precedente, o lo ripristina se già muto
  toggleMute() {
    if (!this.audio) return;
    if (this.audio.volume > 0) {
      this.volumeBeforeMute = this.audio.volume;
      this.setVolume(0);
    } else {
      this.setVolume(this.volumeBeforeMute || 0.5);
    }
  }

  seek(percent) {
    if (!this.audio || !this.audio.duration) return;
    this.audio.currentTime = percent * this.audio.duration;
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    localStorage.setItem(STORAGE_KEY_SHUFFLE, this.isShuffle.toString());
    const btn = document.getElementById("btn-shuffle");
    if (btn) btn.style.color = this.isShuffle ? "#1db954" : "";
    if (this.isShuffle) this.initShufflePool();
  }

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    localStorage.setItem(STORAGE_KEY_REPEAT, this.isRepeat.toString());
    if (this.audio) {
      this.audio.loop = this.isRepeat;
    }
    const btn = document.getElementById("btn-repeat");
    if (btn) {
      btn.style.color = this.isRepeat ? "#1db954" : "";
    }
  }

  initShufflePool() {
    this.shufflePool = this.currentTracklist
      .map((t) => t.id)
      .filter((id) => id !== (this.currentTrack ? this.currentTrack.id : null));
  }

  next() {
    if (this.currentTracklist.length <= 1) {
      this.seek(0);
      return;
    }

    if (this.isShuffle) {
      if (this.shufflePool.length === 0) {
        this.initShufflePool();
        if (this.shufflePool.length === 0) {
          this.seek(0);
          return;
        }
      }
      const randomIndex = Math.floor(Math.random() * this.shufflePool.length);
      const nextTrackId = this.shufflePool[randomIndex];
      this.shufflePool.splice(randomIndex, 1);

      const nextTrack = this.currentTracklist.find((t) => t.id === nextTrackId);
      if (nextTrack) this.play(nextTrack, this.currentTracklist);
    } else {
      const currentIndex = this.currentTracklist.findIndex(
        (t) => t.id === this.currentTrack.id,
      );
      const nextIndex = (currentIndex + 1) % this.currentTracklist.length;
      this.play(this.currentTracklist[nextIndex], this.currentTracklist);
    }
  }

  prev() {
    if (this.currentTracklist.length <= 1 || this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    const currentIndex = this.currentTracklist.findIndex(
      (t) => t.id === this.currentTrack.id,
    );
    const prevIndex =
      (currentIndex - 1 + this.currentTracklist.length) %
      this.currentTracklist.length;
    this.play(this.currentTracklist[prevIndex], this.currentTracklist);
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

  history = history.filter((t) => t.id !== track.id);

  history.unshift(track);

  if (history.length > MAX_HISTORY) {
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
  return getFavourites().some((t) => t.id === trackId);
};
// TODO: se presente per id -> rimuovi; altrimenti aggiungi in testa; salva
const toggleFavourite = (track) => {
  let favourites = getFavourites();
  const exists = favourites.some((t) => t.id === track.id);

  if (exists) {
    favourites = favourites.filter((t) => t.id !== track.id);
  } else {
    favourites.unshift(track);
  }

  localStorage.setItem(STORAGE_KEY_FAVOURITES, JSON.stringify(favourites));

  renderSidebarFavourites();
  // se il filtro generi è aperto, aggiorna la lista con i preferiti appena modificati
  if (filtroActivo === "generi") renderGenreFilter();
};

// Helper playlist — stessa struttura dei preferiti.
// Lucio usa getPlaylist() per costruire i container "La tua playlist".
// Il bottone di aggiunta è implementato da Lucio; questi helper sono condivisi.
const getPlaylist = () => {
  const data = localStorage.getItem(STORAGE_KEY_PLAYLIST);
  return data ? JSON.parse(data) : [];
};

const isInPlaylist = (trackId) => {
  return getPlaylist().some((t) => t.id === trackId);
};

const togglePlaylist = (track) => {
  let playlist = getPlaylist();
  const exists = playlist.some((t) => t.id === track.id);
  if (exists) {
    playlist = playlist.filter((t) => t.id !== track.id);
  } else {
    playlist.unshift(track);
  }
  localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(playlist));
};

/* ============================ 5.5 Playlist multiple ============================ */

// ID speciale che identifica la sezione "Brani che ti piacciono" (i preferiti come playlist)
const PLAYLIST_FAVOURITES = "favourites";

// Restituisce tutte le playlist salvate: [{id, name, tracks}]
const getPlaylists = () => {
  const data = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
  return data ? JSON.parse(data) : [];
};

const getPlaylistById = (id) => {
  return getPlaylists().find((p) => p.id === id) || null;
};

const deletePlaylist = (id) => {
  const updated = getPlaylists().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(updated));
  renderSidebarPlaylists();
};

// Aggiunge o rimuove un brano da una playlist specifica
const toggleTrackInPlaylist = (playlistId, track) => {
  const playlists = getPlaylists();
  const pl = playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  const exists = pl.tracks.some((t) => t.id === track.id);
  if (exists) {
    pl.tracks = pl.tracks.filter((t) => t.id !== track.id);
  } else {
    pl.tracks.unshift(track);
  }
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
  renderSidebarPlaylists();
};

// Crea una nuova playlist vuota con ID univoco basato sul timestamp
const createPlaylist = (name) => {
  const playlists = getPlaylists();
  const newPlaylist = { id: `pl_${Date.now()}`, name, tracks: [] };
  playlists.push(newPlaylist);
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
  renderSidebarPlaylists();
  return newPlaylist;
};

// Migra i brani della vecchia chiave singola alle playlist multiple (eseguita una sola volta)
const migrateOldPlaylist = () => {
  const old = localStorage.getItem(STORAGE_KEY_PLAYLIST);
  if (!old) return;
  const tracks = JSON.parse(old);
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  const existing = getPlaylists();
  if (existing.some((p) => p.id === "migrated")) return;
  existing.push({ id: "migrated", name: "La tua playlist", tracks });
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(existing));
  localStorage.removeItem(STORAGE_KEY_PLAYLIST);
  renderSidebarPlaylists();
};

// Menu a tendina "aggiungi a playlist" (.pl-menu, già stilizzato in app.css) — solo uno aperto alla volta
let openPlMenu = null;
const closePlMenu = () => {
  if (!openPlMenu) return;
  openPlMenu.remove();
  openPlMenu = null;
  document.removeEventListener("click", closePlMenu);
  document.removeEventListener("scroll", closePlMenu, { capture: true });
};

const buildPlMenu = (track) => {
  const menu = document.createElement("div");
  menu.className = "pl-menu";
  menu.addEventListener("click", (e) => e.stopPropagation()); // i click dentro il menu non lo richiudono

  const header = document.createElement("p");
  header.className = "pl-menu-header";
  header.textContent = `Aggiungi "${track.title}" a:`;
  menu.appendChild(header);

  const playlists = getPlaylists();

  if (playlists.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pl-menu-empty";
    empty.textContent = "Nessuna playlist ancora.";
    menu.appendChild(empty);
  } else {
    playlists.forEach((pl) => {
      const item = document.createElement("button");
      item.className = "pl-menu-item";
      item.textContent = pl.name;
      item.addEventListener("click", () => {
        toggleTrackInPlaylist(pl.id, track);
        closePlMenu();
      });
      menu.appendChild(item);
    });
  }

  // riga "crea nuova playlist": al click si trasforma in un campo di testo
  const btnCreate = document.createElement("button");
  btnCreate.className = "pl-menu-item pl-menu-create";
  btnCreate.textContent = "+ Crea nuova playlist";
  btnCreate.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nome playlist";
    input.className = "pl-menu-item";
    input.style.outline = "none"; // niente anello blu di default sopra il menu scuro
    btnCreate.replaceWith(input);
    input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        const newPlaylist = createPlaylist(input.value.trim());
        toggleTrackInPlaylist(newPlaylist.id, track);
        closePlMenu();
      } else if (e.key === "Escape") {
        closePlMenu();
      }
    });
  });
  menu.appendChild(btnCreate);

  return menu;
};

// Bottone "+" per aggiungere un brano a una playlist — classe CSS passata come parametro
const makeAddButton = (track, className) => {
  const btn = document.createElement("button");
  btn.className = className;
  btn.setAttribute("aria-label", "Aggiungi a playlist");
  const icon = document.createElement("ion-icon");
  icon.setAttribute("name", "add-outline");
  btn.appendChild(icon);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    closePlMenu();

    const menu = buildPlMenu(track);
    document.body.appendChild(menu);
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;

    openPlMenu = menu;
    document.addEventListener("click", closePlMenu, { once: true });
    // la posizione è calcolata una sola volta all'apertura: se si scrolla, il menu
    // si "scollegherebbe" dal bottone — più semplice chiuderlo allo scroll
    document.addEventListener("scroll", closePlMenu, {
      capture: true,
      once: true,
    });
  });
  return btn;
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
  const lists = document.querySelectorAll(
    "#sidebar-favs-list, #mobile-favs-list",
  );
  if (!tmplFav || lists.length === 0) return;

  const favourites = getFavourites();

  const buildEmptyItem = () => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.classList.add("dropdown-item", "text-secondary");
    span.textContent = "Nessuno ancora";
    li.appendChild(span);
    return li;
  };

  const buildFavItem = (track) => {
    const item = tmplFav.content.firstElementChild.cloneNode(true);
    item.classList.add("cursor-pointer");
    item.dataset.genre = (track.genre || "").toLowerCase(); // usato dal filtro generi
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
      ...(favourites.length > 0
        ? favourites.map(buildFavItem)
        : [buildEmptyItem()]),
    );
  });
};

// Popola #sidebar-playlists-list e #mobile-playlists-list con le playlist dell'utente
const renderSidebarPlaylists = () => {
  const tmplPlaylist = document.getElementById("tmpl-playlist-item");
  const lists = document.querySelectorAll(
    "#sidebar-playlists-list, #mobile-playlists-list",
  );
  if (!tmplPlaylist || lists.length === 0) return;

  const playlists = getPlaylists();

  const buildEmptyItem = () => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "dropdown-item text-secondary";
    span.textContent = "Nessuna playlist";
    li.appendChild(span);
    return li;
  };

  // voce speciale "Brani che ti piacciono" — punta ai preferiti come playlist
  const buildFavouritesItem = () => {
    const item = tmplPlaylist.content.firstElementChild.cloneNode(true);
    item.querySelector(".playlist-name").textContent = "Brani che ti piacciono";
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      window.location.href = `playlist.html?id=${PLAYLIST_FAVOURITES}`;
    });
    return item;
  };

  const buildPlaylistItem = (playlist) => {
    const item = tmplPlaylist.content.firstElementChild.cloneNode(true);
    item.querySelector(".playlist-name").textContent = playlist.name;
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      window.location.href = `playlist.html?id=${playlist.id}`;
    });
    return item;
  };

  lists.forEach((list) => {
    const items = [buildFavouritesItem(), ...playlists.map(buildPlaylistItem)];
    list.replaceChildren(...items);
  });
};

/* Obsoleta, codice morto
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
    cl
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
  initPage()
  - Chiamata da home.js / search.js / album.js / artist.js / playlist.js
  - Monta il player nel footer e lo restituisce per essere usato.
  - In origine accettava un parametro activePage per la vecchia renderSidebar()
    (sotto, commentata) che evidenziava il link attivo. Da quando la sidebar
    e' statica in HTML, activePage non serviva piu' a nulla: rimosso.
*/
const initPage = () => {
  const player = new Player();
  player.mount();

  window.player = player;

  migrateOldPlaylist();
  renderSidebarFavourites();
  renderSidebarPlaylists();

  // attivo i miei badge filtro (altrimenti i bottoni non fanno niente)
  myFunction();

  // drag-to-scroll verticale sulla sidebar (scrollbar nascosta via CSS)
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    let isDragging = false;
    let hasDragged = false;
    let startY = 0;
    let startScrollTop = 0;

    sidebar.addEventListener("mousedown", (e) => {
      isDragging = true;
      hasDragged = false;
      startY = e.pageY - sidebar.offsetTop;
      startScrollTop = sidebar.scrollTop;
      sidebar.style.cursor = "grabbing";
      e.preventDefault();
    });

    sidebar.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      hasDragged = true;
      const y = e.pageY - sidebar.offsetTop;
      sidebar.scrollTop = startScrollTop - (y - startY);
    });

    const stopDrag = () => {
      if (isDragging && hasDragged) {
        sidebar.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
      }
      isDragging = false;
      sidebar.style.cursor = "";
    };
    sidebar.addEventListener("mouseup", stopDrag);
    sidebar.addEventListener("mouseleave", stopDrag);
  }

  return player;
};

/* ============================ 8. Algoritmo AI suggerimenti ============================ */

let consigliInBackground = null;
let automazioneGiaPartitaPerTraccia = null;

const ottieniSuggerimentiAI = async (currentTrack, buttonElement) => {
  if (!currentTrack) return;
  if (automazioneGiaPartitaPerTraccia === currentTrack.id) return;
  automazioneGiaPartitaPerTraccia = currentTrack.id;

  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      🧠 L'AI sta già elaborando i prossimi consigli in background...
    `;
  }

  try {
    const N8N_WEBHOOK_URL =
      "https://javiertorres.app.n8n.cloud/webhook/e7704661-742b-456b-9d9d-89158ebda3af";

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo: currentTrack.title.replace(/'/g, " "),
        artista: currentTrack.artist.replace(/'/g, " "),
        genere: currentTrack.genre || "Music",
      }),
    });

    if (!response.ok) throw new Error("Errore server");

    const canzoniConsigliateRaw = await response.json();
    let canzoniConsigliate = [];

    canzoniConsigliateRaw.forEach((item) => {
      let target = item.data ? item.data : item.body ? item.body : item;
      if (typeof target === "string") {
        try {
          target = JSON.parse(target.trim());
        } catch (e) {}
      }
      if (target && target.results && Array.isArray(target.results)) {
        target.results.forEach((trackObj) => {
          canzoniConsigliate.push(new Track(trackObj));
        });
      }
    });

    consigliInBackground = {
      titoloBranoOrigine: currentTrack.title,
      tracce: Array.from(new Set(canzoniConsigliate.map((t) => t.id))).map(
        (id) => canzoniConsigliate.find((t) => t.id === id),
      ),
    };

    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.textContent = "✨ Consigli pronti per la fine del brano";
    }
  } catch (error) {
    console.error("Errore pre-caricamento AI:", error);
    consigliInBackground = null;
    automazioneGiaPartitaPerTraccia = null;
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.textContent = "✨ Genera consigli AI";
    }
  }
};

let canzoniGiaRiprodottiAI = [];

const mostraConsigliSbloccati = () => {
  if (
    !consigliInBackground ||
    !consigliInBackground.tracce ||
    consigliInBackground.tracce.length === 0
  )
    return;

  const modal = document.getElementById("ai-modal");
  const titleEl = document.getElementById("ai-modal-title");
  const container = document.getElementById("ai-modal-cards-container");
  const closeBtn = document.getElementById("ai-modal-close");
  const toast = document.getElementById("ai-toast");

  if (!modal || !container) return;

  // aggiorna la riga "Basata sui tuoi gusti" in home
  renderRow("Basata sui tuoi gusti", consigliInBackground.tracce);

  titleEl.textContent = `🧠 Scelte da EpiTunes basate su: ${consigliInBackground.titoloBranoOrigine}`;

  const tracceAI = consigliInBackground.tracce;
  const cardsProdotte = tracceAI.map((t) => buildCard(t, tracceAI));
  container.replaceChildren(...cardsProdotte);

  const chiudiModale = () => {
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("d-none"), 500);
  };

  cardsProdotte.forEach((card) => {
    card.addEventListener("click", () => setTimeout(chiudiModale, 150));
    const btnPlay = card.querySelector(".card-play");
    if (btnPlay) btnPlay.addEventListener("click", () => setTimeout(chiudiModale, 150));
  });

  modal.classList.remove("d-none");
  setTimeout(() => modal.classList.add("show"), 10);

  // sceglie la prima traccia non ancora riprodotta dall'AI
  let canzoneDaRiprodurre = consigliInBackground.tracce.find(
    (t) => !canzoniGiaRiprodottiAI.includes(t.id),
  );
  if (!canzoneDaRiprodurre && consigliInBackground.tracce.length > 0) {
    canzoniGiaRiprodottiAI = [];
    canzoneDaRiprodurre = consigliInBackground.tracce[0];
  }

  if (canzoneDaRiprodurre && window.player) {
    canzoniGiaRiprodottiAI.push(canzoneDaRiprodurre.id);
    window.player.play(canzoneDaRiprodurre, consigliInBackground.tracce);

    if (toast) {
      toast.innerHTML = `✨ Avviata riproduzione basata sui tuoi gusti. Brano corrente: <b>${canzoneDaRiprodurre.title}</b> - ${canzoneDaRiprodurre.artist}`;
      toast.classList.remove("d-none");
      setTimeout(() => toast.classList.add("show"), 50);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.classList.add("d-none"), 400);
      }, 4000);
    }
  }

  closeBtn.onclick = chiudiModale;
  modal.onclick = (e) => {
    if (e.target === modal) chiudiModale();
  };

  consigliInBackground = null;
};
