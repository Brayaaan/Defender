function playEnemyExplosion() {
  return new Promise((resolve, reject) => {
    const sound = new Audio("src/music/Ogg/WybuchWroga.Ogg");
    sound.play()
      .then(() => resolve(sound))
      .catch(error => reject(error));
  });
}