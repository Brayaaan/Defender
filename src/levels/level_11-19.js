class Level11_19 {
  constructor() {
    this.enemies = [];

    this.musicStarted = false;
    
    // Generuj zwykłe kulki tylko na poziomach od 11 do 18
    if (typeof level !== 'undefined' && level < 19) {
      this.generateEnemies();
    }

    // Na poziomie 19 pojawia się tylko Boss 2 (W pełni gotowy i niezależny)
    if (typeof level !== 'undefined' && level === 19) {
      this.enemies.push(new Boss2_OrbitalnyStraznik());
    }
  }

  generateEnemies() {
    let numEnemies = 15; 
    for (let i = 0; i < numEnemies; i++) {
      this.enemies.push(new Enemy2_niebieskie_kulki());
    }
  }

  update(player, enemyBullets) { 
    if (!player.bullets || !Array.isArray(player.bullets)) {
      player.bullets = []; 
    }

    // --- AKTUALIZACJA I OBSŁUGA WROGÓW (KULKI LUB BOSS) ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let enemy = this.enemies[i];
      if (!enemy) continue; 

      // 1. Rozróżnienie aktualizacji w zależności od typu wroga
      if (enemy.constructor.name === 'Boss2_OrbitalnyStraznik') {

        // --- DODANE: Obsługa muzyki dla Bossa2 na poziomie 19 ---
        if (!this.musicStarted) {
          playSoundMartiarkaStanNormalny();
          this.musicStarted = true;
        }

        enemy.update(player); // Boss sam rysuje i aktualizuje ruch swoich pocisków oraz sprawdza kolizje z rakietą

        // Kolizje bezpośrednie ciała bossa z rakietą gracza
        if (enemy.hits(player) && !player.isImmortal) {
          enemy.handleCollision(player); 
        }

        // Warunek usunięcia bossa i zakończenia poziomu po jego śmierci
        if (enemy.isDead) {
          score += enemy.points; 

          // --- DODANE: Zatrzymanie muzyki po śmierci bossa ---
          // Jeśli masz funkcję do zatrzymywania dźwięku, np. stopSound(), użyj jej tutaj:
          stopSoundMartiarkaStanNormalny(); 
          this.musicStarted = false;

          this.enemies.splice(i, 1); // Usunięcie bossa kończy poziom (tablica staje się pusta)
        }

      } else {
        // Logika dla zwykłych niebieskich kulek z poziomów 11-18
        enemy.update(enemyBullets); 

        // Kolizje bezpośrednie kulek z rakietą
        if (enemy.explosionFrame <= 0 && enemy.hits(player) && !player.isImmortal) {
          enemy.handleCollision(player); 
        }

        // Sprawdzenie kolizji pocisków gracza ze zwykłymi kulkami
        for (let j = player.bullets.length - 1; j >= 0; j--) {
          let bullet = player.bullets[j];
          if (enemy.hitByBullet(bullet)) {
            enemy.health--;
            if (enemy.health <= 0 && !enemy.exploded) {
              enemy.startExplosion();
              enemy.exploded = true;
              score += enemy.points;
              let bulletIndex = player.bullets.indexOf(bullet);
              if (bulletIndex !== -1) player.bullets.splice(bulletIndex, 1); 
            }
          }
        }

        // Usunięcie martwej kulki po zakończeniu animacji wybuchu
        if (enemy.exploded && enemy.explosionFrame <= 0) {
          this.enemies.splice(i, 1);
        }
      }
    }

    // --- ZARZĄDZANIE POCISKAMI ZWYKŁYCH WROGÓW (Tylko globalne enemyBullets dla kulek) ---
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      let bullet = enemyBullets[i];
      bullet.update();
      bullet.show();
      if (bullet.x < 0 || bullet.x > width || bullet.y < 0 || bullet.y > height) {
        enemyBullets.splice(i, 1);
      } else if (bullet.hits(player) && !player.isImmortal) {
        player.takeDamage(15);
        enemyBullets.splice(i, 1);
        if (player.shieldPower <= 0) {
          player.startExplosion();
        }
      }
    }
  }

  show() {
    for (let enemy of this.enemies) {
      if (enemy) enemy.show(); 
    }
  }

  isLevelComplete() {
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.enemies.length === 0 && enemyBullets.length === 0;
  }
}