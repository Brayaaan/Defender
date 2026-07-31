class Level1_9 {
  constructor() {
    this.enemies = [];
    this.enemyType = 'Enemy1_zielone_kulki';
    this.maxEnemies = 15;

    // --- POPRAWIONY WARUNEK SPAWNU ---
    // Spawnujemy standardowe 15 wrogów tylko na poziomach 1-8
    if (typeof level !== 'undefined' && level < 9) {
      this.spawnEnemies();
    }

    // warunek na którym poziomie jest boss: Jeśli poziom to 9, dorzucamy Matriarkę do istniejącej tablicy
    if (typeof level !== 'undefined' && level === 9) {
      let boss = new Boss_Matriarka();
      this.enemies.push(boss);
    }
  }

  spawnEnemies() {
    // Jednorazowe spawnowanie dokładnie 15 wrogów
    for (let i = 0; i < this.maxEnemies; i++) {
      this.enemies.push(new window[this.enemyType]());
    }
  }

  update(player) {
    let newSpawns = []; // DODANO: Tymczasowa tablica na nowo powstałe kleszcze

    for (let enemy of this.enemies) {
      enemy.update();
      
      // --- PRZENIESIONA LOGIKA SPAWNOWANIA Z BOSSA ---
      // Jeśli wróg to Matriarka i dała sygnał (flaga shouldSpawnEnemies)
      if (enemy.constructor.name === 'Boss_Matriarka' && enemy.shouldSpawnEnemies) {
        let orbitSpeed = 0.15; 
        for (let m of enemy.minions) {
          // Obliczamy pozycje satelit (tak samo jak przy rysowaniu)
          let mx = enemy.x + cos(m.angle + frameCount * orbitSpeed) * m.dist;
          let my = enemy.y + sin(m.angle + frameCount * orbitSpeed) * m.dist;

          // --- NOWOŚĆ: Pętla tworząca 2 wrogów dla każdego satelity ---
          for (let k = 0; k < 2; k++) {
            let newEnemy = new window[this.enemyType]();
            // Dodajemy małe losowe przesunięcie, żeby kulki nie zespawnowały się w dokładnie tym samym pikselu
            newEnemy.x = mx + random(-15, 15);
            newEnemy.y = my + random(-15, 15);
            
            newSpawns.push(newEnemy); 
          }
        }
        enemy.shouldSpawnEnemies = false; 

      }
      // --- KONIEC LOGIKI SPAWNOWANIA ---

      // --- LOGIKA KLONOWANIA KLESZCZY ---
      if (enemy.shouldClone) {
        let clone = new window[this.enemyType]();
        
        // Klon pojawia się w miejscu rodzica, ale lekko przesunięty
        clone.x = enemy.x;
        clone.y = enemy.y + random(-40, 40);
        
        // Klon dziedziczy passCount, żeby od razu wiedział, na jakim jest etapie
        clone.passCount = enemy.passCount;
        
        // Modyfikujemy lekko prędkość klona
        clone.vx = enemy.vx * random(0.8, 1.2);
        clone.vy = -enemy.vy;
        
        newSpawns.push(clone); // Wrzucamy do tymczasowej tablicy
        enemy.shouldClone = false; // Resetujemy sygnał u rodzica
        
      }

      // Sprawdzenie kolizji z graczem
      if (enemy.explosionFrame <= 0 && typeof enemy.hits === 'function' && enemy.hits(player) && !player.isImmortal) {
        enemy.handleCollision(player);
      }

      // Sprawdzenie kolizji z pociskami gracza
      for (let bullet of player.bullets) {
        if (enemy.explosionFrame <= 0 && typeof enemy.hitByBullet === 'function' && enemy.hitByBullet(bullet)) {
          if (enemy.takeDamage(bullet.damage)) {

            player.bullets = player.bullets.filter(b => b !== bullet); 
            break;
          }
        }
      }
      
      // Reset pozycji po opuszczeniu ekranu
      if (enemy.x + enemy.radius < 0) {
        enemy.x = width; 
        enemy.y = random(23, height - 23);

        // Zwiększamy licznik przelotów u wroga (jeśli to zielona kulka)
        if (typeof enemy.passCount !== 'undefined') {
            enemy.passCount++;

        }
      }
    }

    // DODANO: Na koniec pętli wrzucamy wszystkie nowe kleszcze do głównej gry
    if (newSpawns.length > 0) {
      this.enemies = this.enemies.concat(newSpawns);
    }

    // Usuwanie wrogów po eksplozji
    this.enemies = this.enemies.filter(enemy => !(enemy.explosionFrame <= 0 && enemy.exploded));
  }

  show() {
    for (let enemy of this.enemies) {
      if (enemy) enemy.show(); // Zabezpieczenie przed undefined
    }
  }

  isLevelComplete() {
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.enemies.length === 0 && enemyBullets.length === 0;
  }
}