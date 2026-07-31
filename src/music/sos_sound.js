function playSOSSound() {
  const sound = new Audio("src/music/Ogg/sos_sound.Ogg");
  sound.volume = 0.5;
  sound.play();
}