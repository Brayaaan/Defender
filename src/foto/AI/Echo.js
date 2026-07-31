// Obraz wczytywany natywnie
window.EchoImage = new Image();
window.EchoLoaded = false;

window.EchoImage.onload = () => {
  window.EchoLoaded = true;
  console.log("Obraz Echo.jpg załadowany");
};
window.EchoImage.onerror = (e) => {
  console.error("Błąd ładowania Echo.jpg", e);
};

window.EchoImage.src = "src/foto/AI/Echo.jpg"; // Poprawiona linijka