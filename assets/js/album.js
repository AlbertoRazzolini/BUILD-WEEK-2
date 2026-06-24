/* ============================================================
   album.js — pagina dettaglio album
   ============================================================

   COSA DEVI FARE
   1) initPage("home")
   2) Leggi l'id dell'album dalla query string:
        const id = new URLSearchParams(window.location.search).get("id");
   3) Se manca l'id -> messaggio "Album non trovato" e stop.
   4) fetch /lookup?id=ID&entity=song
      - results[0] è la collection (album)
      - results[1..] sono le track
   5) Costruisci #album-hero con:
      - cover grande (bigArt)
      - kicker "ALBUM"
      - titolo album
      - sotto-riga: artista · anno · numero brani · durata totale
      - button "Play" che chiama player.play sulla prima track
      - button "Cuore" (favourite) sulla prima track
   6) Costruisci #tracklist:
      - una riga per track: numero, titolo, durata, cuore
      - click sulla riga -> player.play(track)
      - click sul cuore -> toggleFavourite(track)
*/

const player = initPage();

const albumHero  = document.querySelector("#album-hero");
const tracklist  = document.querySelector("#tracklist");
const searchInput = document.getElementById("search-input");

const showNotFound = () => {
  const msg = document.createElement("p");
  msg.textContent = "Album non trovato";
  albumHero.replaceChildren(msg);
  tracklist.replaceChildren();
};

const renderHero = (album, firstTrack, tracks) => {
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : "";
  const totalMs = album.tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

  const cover = document.createElement("div");
  cover.classList.add("album-cover");
  const coverImg = document.createElement("img");
  coverImg.src = bigArt(album.cover);
  coverImg.alt = album.title;
  cover.appendChild(coverImg);

  const kicker = document.createElement("p");
  kicker.classList.add("hero-kicker");
  kicker.textContent = "ALBUM";

  const title = document.createElement("h1");
  title.classList.add("hero-title");
  title.textContent = album.title;

  // nome artista come <a> separato per navigare su artist.html senza innerHTML
  const artistLink = document.createElement("a");
  artistLink.textContent = album.artist;
  artistLink.href = `artist.html?id=${album.artistId}`;

  const sub = document.createElement("p");
  sub.className = "hero-sub";
  sub.append(artistLink, ` · ${year} · ${album.trackCount} brani · ${formatTime(totalMs)}`);

  const btnPlay = document.createElement("button");
  btnPlay.classList.add("btn-play-big");
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.addEventListener("click", () => player.play(firstTrack, tracks)); // MARCO- aggiunto ,tracks

  // "Salva album": il cuore aggiunge/rimuove TUTTE le tracce dell'album dai preferiti,
  // non solo la prima — è acceso solo quando l'intero album è già tra i preferiti
  const isAlbumFavourite = () => tracks.length > 0 && tracks.every((t) => isFavourite(t.id));

  const btnFav = document.createElement("button");
  btnFav.classList.add("btn-fav-big");
  btnFav.classList.toggle("is-fav", isAlbumFavourite());
  btnFav.setAttribute("aria-label", "Salva album nei preferiti");
  btnFav.textContent = "♥";
  btnFav.addEventListener("click", () => {
    const shouldRemove = isAlbumFavourite();
    tracks.forEach((t) => {
      if (isFavourite(t.id) === shouldRemove) toggleFavourite(t);
    });
    btnFav.classList.toggle("is-fav", isAlbumFavourite());
  });

  const actions = document.createElement("div");
  actions.classList.add("hero-actions");
  actions.append(btnPlay, btnFav);

  const meta = document.createElement("div");
  meta.classList.add("hero-meta");
  meta.append(kicker, title, sub, actions);

  albumHero.replaceChildren(cover, meta);
};

const renderTracklist = (tracks) => {
  const rows = tracks.map((track, index) => {
    const num = document.createElement("span");
    num.classList.add("track-num");
    num.textContent = String(index + 1);

    const trackTitle = document.createElement("span");
    trackTitle.classList.add("track-title");
    trackTitle.textContent = track.title;

    const time = document.createElement("span");
    time.classList.add("track-time");
    time.textContent = formatTime(track.durationMs);

    const btnFav = document.createElement("button");
    btnFav.classList.add("track-fav");
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
    btnFav.setAttribute("aria-label", "Preferito");
    btnFav.textContent = "♥";
    btnFav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavourite(track);
      btnFav.classList.toggle("is-fav", isFavourite(track.id));
    });

    // qui metto il mio "+" sulla riga per aggiungere il brano a una playlist
    const btnAdd = makeAddButton(track, "track-add");

    const row = document.createElement("div");
    row.classList.add("track-row");
    row.dataset.id = track.id;
    row.append(num, trackTitle, time, btnFav, btnAdd);
    row.addEventListener("click", () => player.play(track, tracks)); // MARCO- aggiunto ,tracks

    return row;
  });

  tracklist.replaceChildren(...rows);
};

const loadAlbum = async () => {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    showNotFound();
    return;
  }

  const data = await fetchJSON(`${API_BASE}/lookup?id=${id}&entity=song`);

  if (!data.results.length) {
    showNotFound();
    return;
  }

  const album = new Album(data.results[0]);
  const tracks = data.results.slice(1).map((raw) => new Track(raw));

  if (!tracks.length) {
    showNotFound();
    return;
  }

  album.tracks = tracks;

  renderHero(album, tracks[0], tracks);
  renderTracklist(tracks);
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

loadAlbum();
