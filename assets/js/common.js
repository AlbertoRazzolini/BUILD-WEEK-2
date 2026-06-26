/**
 * @fileoverview common.js — codice condiviso tra tutte le pagine.
 *
 * REGOLE GENERALI
 * - Solo const e let (mai var)
 * - DOM: querySelector / querySelectorAll
 * - Eventi: addEventListener (mai onclick inline)
 * - fetch + async/await + try/catch
 * - localStorage: setItem / getItem / removeItem (salva sempre stringhe)
 * - Pattern OOP: classi Track, Album, Artist, Player
 *
 * COSA CONTIENE QUESTO FILE
 * 1) Costanti (URL base API, chiavi localStorage)
 * 2) Helpers (fetchJSON, formatTime, bigArt, debounce)
 * 3) Classi modello: Track, Album, Artist
 * 4) Classe Player (gestisce <audio>)
 * 5) localStorage helpers (history, favourites)
 * 6) Render sidebar e player footer
 * 7) Inizializzazione al DOMContentLoaded
 *
 * @example <caption>Uso dell'elemento &lt;audio&gt;</caption>
 * const audio = document.querySelector("#audio-element");
 * audio.src = "https://...preview.m4a"; // URL della preview MP3
 * audio.play();                         // avvia la riproduzione
 * audio.pause();                        // mette in pausa
 * audio.currentTime = 10;               // salta a 10 secondi
 * audio.duration;                       // durata in secondi
 * audio.volume = 0.5;                   // volume tra 0 e 1
 *
 * audio.addEventListener("timeupdate", () => {
 *   // chiamato continuamente durante la riproduzione
 *   const percent = (audio.currentTime / audio.duration) * 100;
 * });
 *
 * audio.addEventListener("ended", () => {
 *   // brano finito
 * });
 *
 * @example <caption>Uso dell'API iTunes</caption>
 * // Ricerca brani
 * fetch("https://itunes.apple.com/search?term=eminem&entity=song&limit=10")
 *
 * // Ricerca album
 * fetch("https://itunes.apple.com/search?term=pink+floyd&entity=album&limit=10")
 *
 * // Ricerca artisti
 * fetch("https://itunes.apple.com/search?term=jovanotti&entity=musicArtist&limit=5")
 *
 * // Dettagli album (con tracce)
 * fetch("https://itunes.apple.com/lookup?id=1440831203&entity=song")
 *
 * // Top tracks artista
 * fetch("https://itunes.apple.com/lookup?id=909253&entity=song&limit=10")
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

/**
 * Carica una URL via JSONP, bypassando il CORS.
 *
 * L'API iTunes Search non manda l'header CORS (Access-Control-Allow-Origin),
 * quindi fetch() viene sempre bloccato dal browser. L'API supporta però
 * il classico parametro JSONP "callback": carichiamo la risposta come
 * <script>, che non è soggetto a CORS, e risolviamo la Promise quando
 * Apple richiama la nostra funzione globale.
 *
 * @param {string} url - URL dell'endpoint iTunes (senza il parametro callback).
 * @returns {Promise<Object>} Promise che risolve con il JSON ritornato dall'API.
 */
const fetchJSONP = (url) => {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement("script");

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Errore di rete (JSONP)"));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${callbackName}`;
    document.body.appendChild(script);
  });
};

/**
 * Fa una richiesta GET (via JSONP, vedi {@link fetchJSONP}) e ritorna i dati JSON.
 * Gestisce errori di rete con try/catch: in caso di errore ritorna
 * `{ results: [], resultCount: 0 }` per semplificare i chiamanti.
 *
 * @param {string} url - URL dell'endpoint iTunes.
 * @returns {Promise<Object>} Dati JSON ritornati dall'API, o un risultato vuoto in caso di errore.
 */
const fetchJSON = async (url) => {
  try {
    return await fetchJSONP(url);
  } catch (error) {
    console.error("fetchJSON ha fallito:", error);
  }
  return { results: [], resultCount: 0 };
};

/**
 * Trasforma la cover 100x100 ritornata dall'API iTunes (artworkUrl100) in
 * una cover 600x600 più grande, sostituendo "100x100" con "600x600" nell'URL.
 *
 * @param {string} url - URL dell'artwork (es. artworkUrl100).
 * @returns {string} URL della cover ad alta risoluzione, o stringa vuota se `url` è falsy.
 */
const bigArt = (url) => {
  if (!url) return "";
  return url.replace("100x100", "600x600");
};

/**
 * Converte una durata in millisecondi nel formato "m:ss".
 *
 * @param {number} ms - Durata in millisecondi.
 * @returns {string} Durata formattata, es. `65000` -> `"1:05"`. Ritorna `"0:00"` se `ms` è falsy.
 */
const formatTime = (ms) => {
  if (!ms) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

/**
 * Restituisce una nuova funzione che chiama `fn` solo dopo `ms` millisecondi
 * di pausa rispetto all'ultima chiamata. Usata per la ricerca al type.
 *
 * @param {Function} fn - Funzione da invocare al termine della pausa.
 * @param {number} ms - Millisecondi di inattività da attendere prima di invocare `fn`.
 * @returns {Function} Funzione "debounced" che accetta gli stessi argomenti di `fn`.
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

/** @type {?string} Filtro badge attualmente attivo: `"artisti"`, `"album"`, `"generi"` o `null`. */
let filtroActivo = null;
/** @type {?string} Genere selezionato nella lista filtro — persiste tra re-render. */
let filtroGeneroActivo = null;

/**
 * Costruisce e renderizza, dentro `#sidebar-filter-results`, la lista dei
 * generi musicali estratti dai preferiti salvati, e riapplica l'evidenziazione
 * del genere eventualmente già attivo.
 *
 * @returns {void}
 */
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
        if (
          el.querySelector(".filter-label")?.textContent === filtroGeneroActivo
        ) {
          el.classList.add("active-genre");
        }
      });
    }
  }
};

/**
 * Attiva i badge filtro della sidebar (`.badge.bg-secondary`): al click
 * mostrano in `#sidebar-filter-results` artisti, album o generi ricavati
 * dai preferiti salvati. Ricliccando il badge già attivo si torna alla
 * vista normale (comportamento "toggle", un solo filtro attivo alla volta).
 *
 * @returns {void}
 */
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
    document
      .querySelectorAll(".card[data-genre]")
      .forEach((c) => (c.style.display = ""));
    document
      .querySelectorAll(
        "#sidebar-favs-list [data-genre], #mobile-favs-list [data-genre]",
      )
      .forEach((item) => item.classList.remove("genre-hidden"));
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

/**
 * Disegna i risultati di un filtro badge dentro `#sidebar-filter-results`,
 * clonando il `<template>` giusto in base al tipo (come già si fa per i preferiti).
 *
 * @param {Array<Object>} lista - Elementi da renderizzare (album, artisti o generi).
 * @param {("album"|"artisti"|"generi")} tipo - Tipo di elementi in `lista`, determina il template da usare.
 * @returns {void}
 */
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
          card.style.display = card.dataset.genre.includes(genreLower)
            ? ""
            : "none";
        });
        document
          .querySelectorAll(
            "#sidebar-favs-list [data-genre], #mobile-favs-list [data-genre]",
          )
          .forEach((item) => {
            const g = item.dataset.genre;
            item.classList.toggle(
              "genre-hidden",
              !!(g && !g.includes(genreLower)),
            );
          });
        // nasconde le sezioni della home che non hanno più card visibili
        [
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

/**
 * Modella un brano restituito dall'API iTunes (wrapperType === "track").
 * Campi utili dell'API: trackId, trackName, artistName, collectionName,
 * collectionId, artistId, artworkUrl100, previewUrl, trackTimeMillis.
 */
class Track {
  /**
   * @param {Object} raw - Oggetto traccia grezzo restituito dall'API iTunes.
   * @param {number} raw.trackId
   * @param {string} raw.trackName
   * @param {string} raw.artistName
   * @param {string} raw.collectionName
   * @param {number} raw.collectionId
   * @param {number} raw.artistId
   * @param {string} raw.artworkUrl100
   * @param {string} raw.previewUrl
   * @param {number} raw.trackTimeMillis
   * @param {string} [raw.primaryGenreName]
   */
  constructor(raw) {
    /** @type {number} ID del brano */
    this.id = raw.trackId;
    /** @type {string} Nome del brano */
    this.title = raw.trackName;
    /** @type {string} Nome dell'artista */
    this.artist = raw.artistName;
    /** @type {string} Nome dell'album */
    this.album = raw.collectionName;
    /** @type {number} ID dell'album */
    this.albumId = raw.collectionId;
    /** @type {number} ID dell'artista */
    this.artistId = raw.artistId;
    /** @type {string} Link immagine copertina (100x100) */
    this.cover = raw.artworkUrl100;
    /** @type {string} Link streaming di 30 secondi */
    this.previewUrl = raw.previewUrl;
    /** @type {number} Durata in millisecondi */
    this.durationMs = raw.trackTimeMillis;
    /** @type {string} Genere del brano (usato dal filtro Generi) */
    this.genre = raw.primaryGenreName;
  }
}

/** Modella un album restituito dall'API iTunes (wrapperType === "collection"). */
class Album {
  /**
   * @param {Object} raw - Oggetto album grezzo restituito dall'API iTunes.
   * @param {number} raw.collectionId
   * @param {string} raw.collectionName
   * @param {string} raw.artistName
   * @param {number} raw.artistId
   * @param {string} raw.artworkUrl100
   * @param {string} raw.releaseDate
   * @param {number} raw.trackCount
   */
  constructor(raw) {
    /** @type {number} ID album */
    this.id = raw.collectionId;
    /** @type {string} Nome album */
    this.title = raw.collectionName;
    /** @type {string} Chi è l'artista */
    this.artist = raw.artistName;
    /** @type {number} ID artista (per link pagina artista) */
    this.artistId = raw.artistId;
    /** @type {string} Cover album */
    this.cover = raw.artworkUrl100;
    /** @type {string} Data di uscita */
    this.releaseDate = raw.releaseDate;
    /** @type {number} Numero di tracce incluse */
    this.trackCount = raw.trackCount;
  }
}

/** Modella un artista restituito dall'API iTunes (wrapperType === "artist"). */
class Artist {
  /**
   * @param {Object} raw - Oggetto artista grezzo restituito dall'API iTunes.
   * @param {number} raw.artistId
   * @param {string} raw.artistName
   * @param {string} [raw.primaryGenreName]
   */
  constructor(raw) {
    /** @type {number} ID artista */
    this.id = raw.artistId;
    /** @type {string} Nome artista */
    this.name = raw.artistName;
    /** @type {string} Genere musicale di questa traccia */
    this.genre = raw.primaryGenreName;
  }
}

/* ============================ 4. Classe Player ============================ */

/**
 * Gestisce la riproduzione audio e la UI del player footer.
 *
 * Eventi audio agganciati internamente:
 * - `"timeupdate"` per aggiornare la progress bar
 * - `"ended"` per passare al brano successivo o fermarsi a fine brano
 */
class Player {
  /**
   * Recupera il tag `<audio>` (`#audio-element`), inizializza lo stato di
   * riproduzione e ripristina shuffle/repeat da localStorage.
   */
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

    // Gestione automatica a fine canzone — in Home parte la "radio AI" (senza modale)
    this.audio.addEventListener("ended", () => {
      // i consigli AI si attivano solo in Home (dove esiste #row-ai)
      const siamoInHome = document.getElementById("row-ai") !== null;

      if (
        siamoInHome &&
        consigliInBackground &&
        consigliInBackground.tracce &&
        consigliInBackground.tracce.length > 0
      ) {
        avviaConsigliAutomatici();
        return; // blocca la coda standard e avvia il prossimo consiglio AI
      }

      if (this.currentTracklist.length > 1) {
        this.next(); // Passa alla prossima se è un album/playlist
      } else {
        this.isPlaying = false;
        const btnToggle = document.getElementById("btn-toggle");
        if (btnToggle) btnToggle.textContent = "▶";
        this.updateNowPlayingUI();
      }
    });
  }
  /**
   * Costruisce e inserisce tutta l'interfaccia del player (cover, titolo,
   * controlli, barra di progresso, volume) dentro `.player` nel footer,
   * e collega i listener di interazione (play/pause, seek, volume, mute,
   * shuffle, repeat, prev/next).
   *
   * @returns {void}
   */
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
  /**
   * Riproduce un brano: imposta `currentTrack`, l'src dell'audio, avvia la
   * riproduzione, aggiorna la UI del footer e salva il brano nello storico.
   *
   * @param {Track} track - Brano da riprodurre (deve avere `previewUrl`).
   * @param {Track[]} [tracklist=[]] - Tracklist da usare per `next()`/`prev()` (es. l'album corrente).
   * @returns {void}
   */
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

    // Pre-carica in background i consigli AI per il brano corrente (solo in Home,
    // dove esiste #row-ai). Si attiva ad ogni brano — anche quelli avviati dalla
    // radio AI — così le proposte si adattano di continuo a ciò che ascolti.
    if (
      typeof ottieniSuggerimentiAI === "function" &&
      document.getElementById("row-ai")
    ) {
      const btnAI = document.getElementById("btn-genera-ai");
      ottieniSuggerimentiAI(this.currentTrack, btnAI);
    }
  }
  /**
   * Alterna play/pausa sul brano corrente. Non fa nulla se nessun brano è caricato.
   *
   * @returns {void}
   */
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

  /**
   * Aggiorna l'icona di un bottone `.card-play`. Gestisce sia il caso in cui
   * contiene testo semplice (search.js) sia il caso `<ion-icon>` (card clonate
   * da `#tmpl-card` in home.js), invece di sovrascrivere sempre con `textContent`.
   *
   * @param {Element} btnPlay - Bottone `.card-play` da aggiornare.
   * @param {boolean} isPlaying - Se true mostra l'icona di pausa, altrimenti quella di play.
   * @returns {void}
   */
  setCardPlayIcon(btnPlay, isPlaying) {
    const icon = btnPlay.querySelector("ion-icon");
    if (icon) {
      icon.setAttribute("name", isPlaying ? "pause-outline" : "play-outline");
    } else {
      btnPlay.textContent = isPlaying ? "⏸" : "▶";
    }
  }

  /**
   * Evidenzia in verde la riga/card del brano corrente e mostra ▶/⏸ su tutte
   * le sue card (usa `querySelectorAll` perché lo stesso brano può comparire
   * in più righe della Home).
   *
   * @returns {void}
   */
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
  /**
   * Imposta il volume dell'audio, aggiorna la UI (barra volume, icona mute)
   * e lo salva in localStorage.
   *
   * @param {number} v - Volume tra 0 e 1.
   * @returns {void}
   */
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

  /**
   * Silenzia il volume salvando il valore precedente, o lo ripristina se già muto.
   *
   * @returns {void}
   */
  toggleMute() {
    if (!this.audio) return;
    if (this.audio.volume > 0) {
      this.volumeBeforeMute = this.audio.volume;
      this.setVolume(0);
    } else {
      this.setVolume(this.volumeBeforeMute || 0.5);
    }
  }

  /**
   * Sposta `currentTime` alla percentuale indicata della durata del brano.
   *
   * @param {number} percent - Percentuale (0-1) della durata totale.
   * @returns {void}
   */
  seek(percent) {
    if (!this.audio || !this.audio.duration) return;
    this.audio.currentTime = percent * this.audio.duration;
  }

  /**
   * Attiva/disattiva lo shuffle, salva lo stato in localStorage e aggiorna
   * il colore del bottone. Se attivato, inizializza la pool di shuffle.
   *
   * @returns {void}
   */
  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    localStorage.setItem(STORAGE_KEY_SHUFFLE, this.isShuffle.toString());
    const btn = document.getElementById("btn-shuffle");
    if (btn) btn.style.color = this.isShuffle ? "#1db954" : "";
    if (this.isShuffle) this.initShufflePool();
  }

  /**
   * Attiva/disattiva la ripetizione del brano corrente (`audio.loop`), salva
   * lo stato in localStorage e aggiorna il colore del bottone.
   *
   * @returns {void}
   */
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

  /**
   * Ricostruisce la pool di ID usata da {@link Player#next} in modalità
   * shuffle, escludendo il brano corrente.
   *
   * @returns {void}
   */
  initShufflePool() {
    this.shufflePool = this.currentTracklist
      .map((t) => t.id)
      .filter((id) => id !== (this.currentTrack ? this.currentTrack.id : null));
  }

  /**
   * Passa al brano successivo nella tracklist corrente. In modalità shuffle
   * pesca (senza ripetizioni) dalla shuffle pool, rigenerandola se vuota;
   * altrimenti avanza in ordine. Se la tracklist ha un solo brano, riavvia
   * semplicemente da capo.
   *
   * @returns {void}
   */
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

  /**
   * Torna al brano precedente nella tracklist corrente. Se sono già passati
   * più di 3 secondi di riproduzione (o la tracklist ha un solo brano),
   * riavvia il brano corrente invece di tornare indietro.
   *
   * @returns {void}
   */
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

/**
 * Legge lo storico di riproduzione da localStorage.
 *
 * @returns {Track[]} Array di brani, al più {@link MAX_HISTORY} elementi.
 */
const getHistory = () => {
  const historyData = localStorage.getItem(STORAGE_KEY_HISTORY);
  return historyData ? JSON.parse(historyData) : [];
};

/**
 * Aggiunge un brano in testa allo storico, rimuovendo eventuali duplicati
 * (stesso id) e tagliando l'array a {@link MAX_HISTORY} elementi.
 *
 * @param {Track} track - Brano da aggiungere allo storico.
 * @returns {void}
 */
const addToHistory = (track) => {
  let history = getHistory();

  history = history.filter((t) => t.id !== track.id);

  history.unshift(track);

  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
};

/**
 * Legge i brani preferiti da localStorage.
 *
 * @returns {Track[]} Array di brani preferiti.
 */
const getFavourites = () => {
  const favouritesData = localStorage.getItem(STORAGE_KEY_FAVOURITES);
  return favouritesData ? JSON.parse(favouritesData) : [];
};

/**
 * Verifica se un brano è tra i preferiti.
 *
 * @param {number} trackId - ID del brano da verificare.
 * @returns {boolean} True se il brano è tra i preferiti.
 */
const isFavourite = (trackId) => {
  return getFavourites().some((t) => t.id === trackId);
};

/**
 * Aggiunge o rimuove un brano dai preferiti (toggle), salva il risultato in
 * localStorage e aggiorna la sidebar (e il filtro generi, se attivo).
 *
 * @param {Track} track - Brano da aggiungere o rimuovere.
 * @returns {void}
 */
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
// Usato per costruire i container "La tua playlist" (vecchia playlist singola,
// vedi migrazione in migrateOldPlaylist).

/**
 * Legge la (vecchia) playlist singola da localStorage.
 *
 * @returns {Track[]} Array di brani nella playlist.
 */
const getPlaylist = () => {
  const data = localStorage.getItem(STORAGE_KEY_PLAYLIST);
  return data ? JSON.parse(data) : [];
};

/**
 * Verifica se un brano è nella (vecchia) playlist singola.
 *
 * @param {number} trackId - ID del brano da verificare.
 * @returns {boolean} True se il brano è nella playlist.
 */
const isInPlaylist = (trackId) => {
  return getPlaylist().some((t) => t.id === trackId);
};

/**
 * Aggiunge o rimuove un brano dalla (vecchia) playlist singola.
 *
 * @param {Track} track - Brano da aggiungere o rimuovere.
 * @returns {void}
 */
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

/** @type {string} ID speciale che identifica la sezione "Brani che ti piacciono" (i preferiti come playlist). */
const PLAYLIST_FAVOURITES = "favourites";

/**
 * Legge tutte le playlist salvate.
 *
 * @returns {Array<{id: string, name: string, tracks: Track[]}>} Array delle playlist.
 */
const getPlaylists = () => {
  const data = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
  return data ? JSON.parse(data) : [];
};

/**
 * Cerca una playlist per ID.
 *
 * @param {string} id - ID della playlist.
 * @returns {?{id: string, name: string, tracks: Track[]}} La playlist trovata, o `null`.
 */
const getPlaylistById = (id) => {
  return getPlaylists().find((p) => p.id === id) || null;
};

/**
 * Elimina una playlist per ID e aggiorna la sidebar.
 *
 * @param {string} id - ID della playlist da eliminare.
 * @returns {void}
 */
const deletePlaylist = (id) => {
  const updated = getPlaylists().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(updated));
  renderSidebarPlaylists();
};

/**
 * Aggiunge o rimuove (toggle) un brano da una playlist specifica.
 *
 * @param {string} playlistId - ID della playlist target.
 * @param {Track} track - Brano da aggiungere o rimuovere.
 * @returns {void}
 */
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

/**
 * Crea una nuova playlist vuota con ID univoco basato sul timestamp,
 * la salva e aggiorna la sidebar.
 *
 * @param {string} name - Nome della nuova playlist.
 * @returns {{id: string, name: string, tracks: Track[]}} La playlist appena creata.
 */
const createPlaylist = (name) => {
  const playlists = getPlaylists();
  const newPlaylist = { id: `pl_${Date.now()}`, name, tracks: [] };
  playlists.push(newPlaylist);
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
  renderSidebarPlaylists();
  return newPlaylist;
};

/**
 * Migra i brani della vecchia chiave singola ({@link STORAGE_KEY_PLAYLIST})
 * alle playlist multiple, eseguita una sola volta (idempotente: salta se la
 * playlist `"migrated"` esiste già).
 *
 * @returns {void}
 */
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

/** @type {?Element} Riferimento al menu "aggiungi a playlist" attualmente aperto, o `null`. */
let openPlMenu = null;

/**
 * Chiude (rimuove dal DOM) il menu "aggiungi a playlist" attualmente aperto,
 * se presente, e rimuove i listener associati.
 *
 * @returns {void}
 */
const closePlMenu = () => {
  if (!openPlMenu) return;
  openPlMenu.remove();
  openPlMenu = null;
  document.removeEventListener("click", closePlMenu);
  document.removeEventListener("scroll", closePlMenu, { capture: true });
};

/**
 * Costruisce il menu a tendina "aggiungi a playlist" per un brano: elenca le
 * playlist esistenti (click per aggiungere/rimuovere il brano) e una voce
 * "+ Crea nuova playlist" che si trasforma in un campo di testo al click.
 *
 * @param {Track} track - Brano da aggiungere/rimuovere dalle playlist.
 * @returns {Element} Elemento `.pl-menu` pronto per essere inserito nel DOM.
 */
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

/**
 * Crea un bottone "+" che, al click, apre il menu {@link buildPlMenu} per
 * aggiungere il brano a una playlist, posizionandolo sotto il bottone stesso.
 *
 * @param {Track} track - Brano da aggiungere a una playlist.
 * @param {string} className - Classe CSS da applicare al bottone.
 * @returns {Element} Elemento `<button>` pronto per essere inserito nel DOM.
 */
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

/**
 * Popola `#sidebar-favs-list` (desktop) e `#mobile-favs-list` (offcanvas
 * mobile) clonando `#tmpl-fav-item` per ciascun preferito. Se non ci sono
 * preferiti, mostra il placeholder "Nessuno ancora".
 *
 * @returns {void}
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

/**
 * Popola `#sidebar-playlists-list` e `#mobile-playlists-list` con le playlist
 * dell'utente, includendo sempre in testa la voce speciale "Brani che ti piacciono".
 *
 * @returns {void}
 */
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

/**
 * Inizializza la pagina: chiamata da home.js / search.js / album.js /
 * artist.js / playlist.js. Monta il player nel footer, migra la vecchia
 * playlist singola, renderizza preferiti e playlist in sidebar, attiva i
 * badge filtro e il drag-to-scroll verticale della sidebar.
 *
 * In origine accettava un parametro `activePage` per la vecchia
 * `renderSidebar()` (sopra, commentata) che evidenziava il link attivo. Da
 * quando la sidebar è statica in HTML, `activePage` non serviva più a nulla
 * ed è stato rimosso.
 *
 * @returns {Player} L'istanza del player montata (esposta anche su `window.player`).
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
        sidebar.addEventListener("click", (e) => e.stopPropagation(), {
          capture: true,
          once: true,
        });
      }
      isDragging = false;
      sidebar.style.cursor = "";
    };
    sidebar.addEventListener("mouseup", stopDrag);
    sidebar.addEventListener("mouseleave", stopDrag);
  }

  return player;
};

/* ============================ 8. Consigli AI (n8n) ============================ */
/*
  Sistema di consigli "Basata sui tuoi gusti":
  - ad ogni play() pre-carica in background dei brani simili da un webhook n8n
  - quando il brano in Home finisce, mostra una modale dorata + un toast e
    avvia automaticamente il primo brano consigliato non ancora riprodotto
  Tutto è isolato: su pagine senza #row-ai i consigli non vengono mostrati.
*/

let consigliInBackground = null; // ultimi consigli pre-caricati { titoloBranoOrigine, tracce }
let automazioneGiaPartitaPerTraccia = null; // evita doppie chiamate per lo stesso brano
let canzoniGiaRiprodottiAI = []; // memoria di sessione: evita di ripetere gli stessi consigli

const ottieniSuggerimentiAI = async (currentTrack, buttonElement) => {
  if (!currentTrack) return;

  // se ho già lanciato la richiesta per questo brano, non la rifaccio
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
    // URL di TEST n8n (/webhook-test/): funziona solo mentre nel workflow è
    // attivo "Listen for test event", e per una sola esecuzione alla volta.
    // Per la produzione usare "/webhook/" con il workflow attivo (toggle Active).
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Il webhook a volte risponde con corpo vuoto o testo non-JSON: leggo prima
    // come testo ed esco con grazia, invece di far esplodere response.json().
    const rawText = await response.text();
    if (!rawText.trim()) {
      console.warn(
        "Webhook AI: risposta vuota — nessun consiglio. Controlla il nodo 'Respond to Webhook' in n8n.",
      );
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = "✨ Genera consigli AI";
      }
      return;
    }

    let canzoniConsigliateRaw;
    try {
      canzoniConsigliateRaw = JSON.parse(rawText);
    } catch (e) {
      console.warn(
        "Webhook AI: risposta non in formato JSON:",
        rawText.slice(0, 200),
      );
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.textContent = "✨ Genera consigli AI";
      }
      return;
    }

    const canzoniConsigliate = [];

    // accetto sia un array sia un singolo oggetto, poi normalizzo i risultati annidati
    const elementi = Array.isArray(canzoniConsigliateRaw)
      ? canzoniConsigliateRaw
      : [canzoniConsigliateRaw];
    elementi.forEach((item) => {
      let target = item.data ? item.data : item.body ? item.body : item;
      if (typeof target === "string") {
        try {
          target = JSON.parse(target.trim());
        } catch (e) {
          /* stringa non JSON: la ignoro */
        }
      }
      if (target && target.results && Array.isArray(target.results)) {
        target.results.forEach((trackObj) => {
          canzoniConsigliate.push(new Track(trackObj));
        });
      }
    });

    // dedup per id mantenendo l'ordine
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
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.textContent = "✨ Genera consigli AI";
    }
  }
};

// Radio AI: senza modale. Stampa la riga "Basata sui tuoi gusti" in Home e
// avvia automaticamente il prossimo consiglio non ancora riprodotto. Ogni brano
// avviato pre-carica i propri consigli, quindi la radio si adatta di continuo.
const avviaConsigliAutomatici = () => {
  if (
    !consigliInBackground ||
    !consigliInBackground.tracce ||
    consigliInBackground.tracce.length === 0
  )
    return;

  // copio in locali i dati prima di consumarli (consigliInBackground viene azzerato a fine funzione)
  const tracce = consigliInBackground.tracce;
  consigliInBackground = null; // consumati: il prossimo brano ne pre-caricherà di nuovi

  // 1. stampa/accumula i consigli nella sezione fissa della Home (renderRow vive in home.js)
  if (typeof renderRow === "function") {
    renderRow("Basata sui tuoi gusti", tracce);
  }

  // 2. anti-ripetizione: scelgo il primo consiglio mai avviato in automatico
  let canzoneDaRiprodurre = tracce.find(
    (t) => !canzoniGiaRiprodottiAI.includes(t.id),
  );
  // se le ho ascoltate tutte, resetto la memoria e riparto dalla prima
  if (!canzoneDaRiprodurre) {
    canzoniGiaRiprodottiAI = [];
    canzoneDaRiprodurre = tracce[0];
  }

  // 3. avvio il brano (con l'intera lista come coda di fallback) e mostro un toast discreto
  if (canzoneDaRiprodurre && window.player) {
    canzoniGiaRiprodottiAI.push(canzoneDaRiprodurre.id);
    window.player.play(canzoneDaRiprodurre, tracce);

    const toast = document.getElementById("ai-toast");
    if (toast) {
      toast.innerHTML = `✨ Radio basata sui tuoi gusti · <b>${canzoneDaRiprodurre.title}</b> — ${canzoneDaRiprodurre.artist}`;
      toast.classList.remove("d-none");
      setTimeout(() => toast.classList.add("show"), 50);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.classList.add("d-none"), 400);
      }, 4000);
    }
  }
};
