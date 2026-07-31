function playRocketExplosion() {
  return new Promise((resolve, reject) => {
    const sound = new Audio("src/music/Ogg/WybuchRakiety.Ogg");
    sound.play()
      .then(() => resolve(sound))
      .catch(error => reject(error));
  });
}