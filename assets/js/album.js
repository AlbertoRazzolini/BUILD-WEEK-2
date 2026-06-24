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

const player = initPage("home");

const albumHero  = document.querySelector("#album-hero");
const tracklist  = document.querySelector("#tracklist");

const showNotFound = () => {
  const msg = document.createElement("p");
  msg.textContent = "Album non trovato";
  albumHero.replaceChildren(msg);
  tracklist.replaceChildren();
};

const renderHero = (album, firstTrack) => {
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : "";
  const totalMs = album.tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

  const cover = document.createElement("div");
  cover.className = "album-cover";
  const coverImg = document.createElement("img");
  coverImg.src = bigArt(album.cover);
  coverImg.alt = album.title;
  cover.appendChild(coverImg);

  const kicker = document.createElement("p");
  kicker.className = "hero-kicker";
  kicker.textContent = "ALBUM";

  const title = document.createElement("h1");
  title.className = "hero-title";
  title.textContent = album.title;

  const sub = document.createElement("p");
  sub.className = "hero-sub";
  sub.textContent = `${album.artist} · ${year} · ${album.trackCount} brani · ${formatTime(totalMs)}`;

  const btnPlay = document.createElement("button");
  btnPlay.className = "btn-play-big";
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.addEventListener("click", () => player.play(firstTrack, tracks)); // MARCO- aggiunto ,tracks

  const btnFav = document.createElement("button");
  btnFav.className = "btn-fav-big";
  btnFav.classList.toggle("is-fav", isFavourite(firstTrack.id));
  btnFav.setAttribute("aria-label", "Preferito");
  btnFav.textContent = "♥";
  btnFav.addEventListener("click", () => {
    toggleFavourite(firstTrack);
    btnFav.classList.toggle("is-fav", isFavourite(firstTrack.id));
  });

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  actions.append(btnPlay, btnFav);

  const meta = document.createElement("div");
  meta.className = "hero-meta";
  meta.append(kicker, title, sub, actions);

  albumHero.replaceChildren(cover, meta);
};

const renderTracklist = (tracks) => {
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
    btnFav.textContent = "♥";
    btnFav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavourite(track);
      btnFav.classList.toggle("is-fav", isFavourite(track.id));
    });

    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.id = track.id;
    row.append(num, trackTitle, time, btnFav);
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

  renderHero(album, tracks[0]);
  renderTracklist(tracks);
};

loadAlbum();
