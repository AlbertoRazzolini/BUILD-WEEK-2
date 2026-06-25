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

const player = initPage();

const input        = document.querySelector("#search-input");
const rowTracks    = document.querySelector("#row-tracks");
const rowAlbums    = document.querySelector("#row-albums");
const rowArtists   = document.querySelector("#row-artists");
const gridTracks   = document.querySelector("#grid-tracks");
const gridAlbums   = document.querySelector("#grid-albums");
const gridArtists  = document.querySelector("#grid-artists");

const renderTrackCard = (track, tracklist = []) => {
  const card = document.createElement("div");
  card.classList.add("card");
  card.dataset.id = track.id;

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap");
  const img = document.createElement("img");
  img.src = bigArt(track.cover);
  img.alt = track.title;
  imageWrap.appendChild(img);

  // card-add ("+") in alto a sinistra dentro imageWrap — coerente con le card della home
  imageWrap.appendChild(makeAddButton(track, "card-add"));

  // card-fav (cuore) in alto a destra dentro imageWrap — coerente con le card della home
  const btnFav = document.createElement("button");
  btnFav.classList.add("card-fav");
  btnFav.classList.toggle("is-fav", isFavourite(track.id));
  btnFav.setAttribute("aria-label", "Preferito");
  const favIcon = document.createElement("ion-icon");
  favIcon.setAttribute("name", "heart-outline");
  btnFav.appendChild(favIcon);
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
  });
  imageWrap.appendChild(btnFav);

  const btnPlay = document.createElement("button");
  btnPlay.classList.add("card-play");
  btnPlay.setAttribute("aria-label", "Play");
  const playIcon = document.createElement("ion-icon");
  playIcon.setAttribute("name", "play-outline");
  btnPlay.appendChild(playIcon);
  btnPlay.addEventListener("click", (event) => {
    event.stopPropagation();
    player.play(track, tracklist);
  });
  imageWrap.appendChild(btnPlay);

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = track.title;

  const sub = document.createElement("a");
  sub.className = "card-sub";
  sub.textContent = track.artist;
  sub.href = `artist.html?id=${track.artistId}`;
  sub.addEventListener("click", (e) => e.stopPropagation());

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => player.play(track, tracklist));

  return card;
};

const renderAlbumCard = (album) => {
  const card = document.createElement("div");
  card.classList.add("card");

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap");
  const img = document.createElement("img");
  img.src = album.cover;
  img.alt = album.title;
  imageWrap.appendChild(img);

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = album.title;

  // artista dell'album come link: click → artist.html; stopPropagation evita di attivare anche il click sull'intera card (album.html)
  const sub = document.createElement("a");
  sub.className = "card-sub";
  sub.textContent = album.artist;
  sub.href = `artist.html?id=${album.artistId}`;
  sub.addEventListener("click", (e) => e.stopPropagation());

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `album.html?id=${album.id}`;
  });

  return card;
};

const renderArtistCard = (artist) => {
  const card = document.createElement("div");
  card.classList.add("card");

  const imageWrap = document.createElement("div");
  imageWrap.classList.add("card-image-wrap", "round");
  imageWrap.style.display = "grid";
  imageWrap.style.placeItems = "center";
  imageWrap.style.fontSize = "32px";
  imageWrap.textContent = "🎤";

  const title = document.createElement("p");
  title.classList.add("card-title", "text-white");
  title.textContent = artist.name;

  const sub = document.createElement("p");
  sub.classList.add("card-sub");
  sub.textContent = artist.genre || "Artista";

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `artist.html?id=${artist.id}`;
  });

  return card;
};

const showRow = (section, grid, items, renderCard) => {
  grid.replaceChildren(...items.map(renderCard));
  section.hidden = items.length === 0;
};

const doSearch = async (term) => {
  if (!term || term.length < 1) {
    showRow(rowTracks, gridTracks, [], renderTrackCard);
    showRow(rowAlbums, gridAlbums, [], renderAlbumCard);
    showRow(rowArtists, gridArtists, [], renderArtistCard);
    return;
  }

  localStorage.setItem(STORAGE_KEY_LAST_SEARCH, term);

  const [tracksData, albumsData, artistsData] = await Promise.all([
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=song&limit=20`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=album&limit=8`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=8`,
    ),
  ]);

  const tracks = tracksData.results.map((raw) => new Track(raw));
  showRow(rowTracks, gridTracks, tracks, (track) => renderTrackCard(track, tracks));
  showRow(rowAlbums, gridAlbums, albumsData.results.map((raw) => new Album(raw)), renderAlbumCard);
  showRow(rowArtists, gridArtists, artistsData.results.map((raw) => new Artist(raw)), renderArtistCard);
};

const debouncedSearch = debounce(doSearch, 400);

input.addEventListener("input", (event) => {
  debouncedSearch(event.target.value.trim());
});

const lastQuery = localStorage.getItem(STORAGE_KEY_LAST_SEARCH);
if (lastQuery) {
  input.value = lastQuery;
  doSearch(lastQuery);
}
