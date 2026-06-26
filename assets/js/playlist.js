/**
 * @fileoverview playlist.js — pagina di dettaglio di una playlist.
 *
 * Legge l'id dalla query string: se è {@link PLAYLIST_FAVOURITES}
 * ("favourites") mostra i preferiti, altrimenti recupera la playlist
 * corrispondente e i suoi brani. Disegna l'intestazione (hero) con bottone
 * Play (e cestino per eliminarla, solo sulle playlist non-preferiti) e la
 * lista dei brani sotto.
 */

const player = initPage();

const playlistHero = document.querySelector("#playlist-hero");
const tracklist = document.querySelector("#tracklist");
const searchInput = document.getElementById("search-input");

// invio sulla searchbar -> vado alla pagina di ricerca (come nelle altre pagine)
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

/**
 * Mostra il messaggio "Playlist non trovata" al posto dell'hero e svuota la tracklist.
 *
 * @returns {void}
 */
const showNotFound = () => {
  const msg = document.createElement("p");
  msg.textContent = "Playlist non trovata";
  playlistHero.replaceChildren(msg);
  tracklist.replaceChildren();
};

/**
 * Costruisce `#playlist-hero`: cover (del primo brano, o icona 🎵 se vuota),
 * kicker "PLAYLIST", titolo, sotto-riga (numero brani · durata totale),
 * bottone Play (disabilitato se vuota) e, solo per le playlist non-preferiti,
 * un bottone cestino che elimina la playlist e torna alla home.
 *
 * @param {string} title - Titolo da mostrare (nome playlist o "Brani che ti piacciono").
 * @param {Track[]} tracks - Brani della playlist.
 * @param {string} playlistId - ID della playlist (o {@link PLAYLIST_FAVOURITES}).
 * @param {boolean} isFavourites - True se questa è la playlist speciale dei preferiti.
 * @returns {void}
 */
const renderHero = (title, tracks, playlistId, isFavourites) => {
  const totalMs = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

  const cover = document.createElement("div");
  cover.className = "album-cover";
  // come copertina uso quella del primo brano, altrimenti un'icona
  if (tracks.length > 0 && tracks[0].cover) {
    const coverImg = document.createElement("img");
    coverImg.src = bigArt(tracks[0].cover);
    coverImg.alt = title;
    cover.appendChild(coverImg);
  } else {
    cover.style.display = "grid";
    cover.style.placeItems = "center";
    cover.style.fontSize = "72px";
    cover.textContent = "🎵";
  }

  const kicker = document.createElement("p");
  kicker.className = "hero-kicker";
  kicker.textContent = "PLAYLIST";

  const titleEl = document.createElement("h1");
  titleEl.className = "hero-title";
  titleEl.textContent = title;

  const sub = document.createElement("p");
  sub.className = "hero-sub";
  const braniLabel = tracks.length === 1 ? "brano" : "brani";
  sub.textContent =
    tracks.length > 0
      ? `${tracks.length} ${braniLabel} · ${formatTime(totalMs)}`
      : "Nessun brano";

  const btnPlay = document.createElement("button");
  btnPlay.className = "btn-play-big";
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.disabled = tracks.length === 0;
  btnPlay.addEventListener("click", () => {
    if (tracks.length > 0) player.play(tracks[0], tracks);
  });

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  actions.append(btnPlay);

  // metto il cestino solo sulle mie playlist, non sui preferiti
  if (!isFavourites) {
    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-fav-big";
    btnDelete.setAttribute("aria-label", "Elimina playlist");
    btnDelete.title = "Elimina playlist";
    btnDelete.textContent = "🗑";
    btnDelete.addEventListener("click", () => {
      if (confirm(`Eliminare la playlist "${title}"?`)) {
        deletePlaylist(playlistId);
        window.location.href = "index.html";
      }
    });
    actions.append(btnDelete);
  }

  const meta = document.createElement("div");
  meta.className = "hero-meta";
  meta.append(kicker, titleEl, sub, actions);

  playlistHero.replaceChildren(cover, meta);
};

/**
 * Costruisce `#tracklist`: se vuota mostra un messaggio placeholder
 * (diverso per preferiti/playlist), altrimenti una riga per brano con
 * numero, titolo, durata, bottone preferito e un bottone azione che varia
 * per contesto — "+" per aprire il menu playlist sui preferiti, "✕" per
 * rimuovere il brano sulle playlist normali. Click sulla riga -> `player.play(track, tracks)`.
 *
 * @param {Track[]} tracks - Brani della playlist da renderizzare.
 * @param {string} playlistId - ID della playlist (o {@link PLAYLIST_FAVOURITES}).
 * @param {boolean} isFavourites - True se questa è la playlist speciale dei preferiti.
 * @param {Function} render - Callback per ridisegnare la pagina dopo una modifica (preferito o rimozione).
 * @returns {void}
 */
const renderTracklist = (tracks, playlistId, isFavourites, render) => {
  if (tracks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = isFavourites
      ? "Nessun brano tra i preferiti. Usa il cuore ♥ per aggiungerne."
      : "Questa playlist è vuota. Aggiungi brani col pulsante +.";
    tracklist.replaceChildren(empty);
    return;
  }

  const rows = tracks.map((track, index) => {
    const num = document.createElement("span");
    num.className = "track-num";
    num.textContent = String(index + 1);

    const trackTitle = document.createElement("span");
    trackTitle.className = "track-title";
    trackTitle.textContent = track.title;

    const time = document.createElement("span");
    time.className = "track-time";
    time.textContent = formatTime(track.durationMs);

    const btnFav = document.createElement("button");
    btnFav.className = "track-fav";
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
    btnFav.setAttribute("aria-label", "Preferito");
    const heartIcon = document.createElement("ion-icon");
    heartIcon.setAttribute("name", isFavourite(track.id) ? "heart" : "heart-outline");
    btnFav.appendChild(heartIcon);
    btnFav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavourite(track);
      render(); // se è la pagina dei preferiti la riga sparisce
    });

    let btnAction;
    if (isFavourites) {
      // sui preferiti uso il "+" che apre il mio menù delle playlist
      btnAction = makeAddButton(track, "track-add");
    } else {
      // sulle mie playlist invece uso "✕" per togliere il brano da qui
      btnAction = document.createElement("button");
      btnAction.className = "track-add is-added";
      btnAction.textContent = "✕";
      btnAction.title = "Rimuovi da questa playlist";
      btnAction.setAttribute("aria-label", "Rimuovi da questa playlist");
      btnAction.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTrackInPlaylist(playlistId, track);
        render(); // la riga rimossa sparisce subito
      });
    }

    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.id = track.id;
    row.append(num, trackTitle, time, btnFav, btnAction);
    row.addEventListener("click", () => player.play(track, tracks));

    return row;
  });

  tracklist.replaceChildren(...rows);
};

/**
 * Legge l'id playlist dalla query string e renderizza hero + tracklist.
 * Definisce internamente `render()`, che rilegge i dati aggiornati da
 * localStorage e ridisegna tutta la pagina — passata a {@link renderTracklist}
 * per riapplicarsi dopo un toggle preferito/rimozione brano.
 *
 * @returns {void}
 */
const loadPlaylist = () => {
  const id = new URLSearchParams(window.location.search).get("id");

  // ogni volta rileggo i dati aggiornati e ridisegno tutta la pagina
  const render = () => {
    const isFavourites = id === PLAYLIST_FAVOURITES;
    let title;
    let tracks;

    if (isFavourites) {
      title = "Brani che ti piacciono";
      tracks = getFavourites();
    } else {
      const playlist = getPlaylistById(id);
      if (!playlist) {
        showNotFound();
        return;
      }
      title = playlist.name;
      tracks = playlist.tracks;
    }

    renderHero(title, tracks, id, isFavourites);
    renderTracklist(tracks, id, isFavourites, render);
  };

  render();
};

loadPlaylist();