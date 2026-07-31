const bombMechanics = (function() {
  let bombs = 3; // Przywrócenie 3 bomb na start z limitem 15
  let standardBombTimer = 0; // Licznik klatek opóźnienia, potrzebny do opóźnienia obrażeń bomby zwykłej

  function init() {
    bombs = 3; // Inicjalizacja liczby bomb na 3 z limitem 15
    standardBombTimer = 0; // Zerowanie licznika opóźnienia działania bomb przy nowej grze
    if (!window.bombBoosts) window.bombBoosts = []; // Inicjalizacja globalnej tablicy, jeśli nie istnieje
  }

  function update(cave, pg) {
    let toRemove = [];
    if (window.bombBoosts && window.bombBoosts.length > 0) {
      for (let i = 0; i < window.bombBoosts.length; i++) {
        window.bombBoosts[i].update(cave);
        window.bombBoosts[i].show(pg);

        if (window.bombBoosts[i].collected(player)) {
          bombs = Math.min(15, bombs + 1); // Zwiększ o 1, ale nie przekraczaj 15
          toRemove.push(i);
          playSoundSferaBomb();

        }
        if (window.bombBoosts[i].x < 0) {
          toRemove.push(i);

        }
      }
      for (let i = toRemove.length - 1; i >= 0; i--) {
        window.bombBoosts.splice(toRemove[i], 1);
      }
    }

    // Opóźnienie wywołania obrażeń : Odliczanie sekundy i zadawanie obrażeń
    if (standardBombTimer > 0) {
      standardBombTimer--;
      
      if (standardBombTimer === 0) {
        // Oryginalna logika zadawania obrażeń przeniesiona z useBomb
        if (currentLevel && currentLevel.enemies) {
          for (let i = 0; i < currentLevel.enemies.length; i++) {
            if (circleCircleCollision(player.x, player.y, 15 * player.width, currentLevel.enemies[i].x, currentLevel.enemies[i].y, currentLevel.enemies[i].radius)) {
              currentLevel.enemies[i].takeDamage(25);
              if (currentLevel.enemies[i].exploded) {

              }
            }
          }
        }
        if (cave && cave.bats) {
          for (let i = 0; i < cave.bats.length; i++) {
            if (circleCircleCollision(player.x, player.y, 15 * player.width, cave.bats[i].x, cave.bats[i].y, cave.bats[i].radius)) {
              if (!cave.bats[i].explosionFrame) {
                cave.bats[i].explode();
                score += cave.bats[i].points;

              }
            }
          }
        }
        if (cave && cave.spiders) {
          for (let i = 0; i < cave.spiders.length; i++) {
            if (circleCircleCollision(player.x, player.y, 15 * player.width, cave.spiders[i].x, cave.spiders[i].y, cave.spiders[i].radius)) {
              if (!cave.spiders[i].explosionFrame) {
                cave.spiders[i].explode();
                score += cave.spiders[i].points;

              }
            }
          }
        }
        if (typeof player !== 'undefined' && player.lastCollisionTimes) {
          player.lastCollisionTimes = [];
        }

      }
    }

  }

  function useBomb() {
    if (bombs <= 0) return; // Brak akcji, jeśli nie ma bomb

    bombs = Math.max(0, bombs - 1); // Zawsze odejmuj 1 bombę

    if (bombs < 5) {
      // Standardowa bomba - TERAZ TYLKO URUCHAMIAMY ANIMACJĘ, DŹWIĘK I TIMER
      player.bombAnimationProgress = 1;
      standardBombTimer = 60; // Opóźnienie zadawania obrażeń wrogom na 60 klatek (1 sekunda)
      playBomb1Sound(); // Dźwięk dla bomby standardowej

    }

      else if (bombs < 10) {
      // Bomba Piorun
      player.lightningBombAnimationProgress = 1;
      if (currentLevel && currentLevel.enemies) {
        for (let i = 0; i < currentLevel.enemies.length; i++) {
          currentLevel.enemies[i].takeDamage(75);
          if (currentLevel.enemies[i].health <= 0 && !currentLevel.enemies[i].exploded) {
            currentLevel.enemies[i].exploded = true;

          }
        }
      }
      if (cave && cave.bats) {
        for (let i = 0; i < cave.bats.length; i++) {
          cave.bats[i].takeDamage(75);
          if (cave.bats[i].health <= 0 && !cave.bats[i].explosionFrame) {
            cave.bats[i].explode();

          }
        }
      }
      if (cave && cave.spiders) {
        for (let i = 0; i < cave.spiders.length; i++) {
          cave.spiders[i].takeDamage(75);
          if (cave.spiders[i].health <= 0 && !cave.spiders[i].explosionFrame) {
            cave.spiders[i].explode();

          }
        }
      }
      playBomb2Sound(); // Dźwięk dla bomby piorunowej

    }
      else {
      // Bomba Atomowa (10-15 bomb)
      player.atomicBombAnimationProgress = 1;
      if (currentLevel && currentLevel.enemies) {
        for (let i = 0; i < currentLevel.enemies.length; i++) {
          currentLevel.enemies[i].takeDamage(125);
          if (currentLevel.enemies[i].health <= 0 && !currentLevel.enemies[i].exploded) {
            currentLevel.enemies[i].exploded = true;

          }
        }
      }
      if (cave && cave.bats) {
        for (let i = 0; i < cave.bats.length; i++) {
          cave.bats[i].takeDamage(125);
          if (cave.bats[i].health <= 0 && !cave.bats[i].explosionFrame) {
            cave.bats[i].explode();

          }
        }
      }
      if (cave && cave.spiders) {
        for (let i = 0; i < cave.spiders.length; i++) {
          cave.spiders[i].takeDamage(125);
          if (cave.spiders[i].health <= 0 && !cave.spiders[i].explosionFrame) {
            cave.spiders[i].explode();

          }
        }
      }
      playBomb3Sound(); // Dźwięk dla bomby atomowej

    }
  }

  function getBombSymbols() {
    let symbols = [];
    // Dodaj odpowiednią liczbę symboli 💣 dla zakresu 1-5
    if (bombs >= 1) {
      for (let i = 0; i < Math.min(bombs, 5); i++) {
        symbols.push("💣");
      }
    }
    // Dodaj odpowiednią liczbę symboli ⚡ dla zakresu 6-10
    if (bombs >= 6) {
      let lightningCount = Math.min(bombs - 5, 5); // Od 1 przy 6 do 5 przy 10
      for (let i = 0; i < lightningCount; i++) {
        symbols.push("⚡");
      }
    }
    // Dodaj symbole ☢️ dla zakresu 11-15
    if (bombs >= 11) {
      let atomicCount = Math.min(bombs - 10, 5); // Od 1 przy 11 do 5 przy 15
      for (let i = 0; i < atomicCount; i++) {
        symbols.push("☢️");
      }
    }
    return symbols.length > 0 ? `Bomby: ${symbols.join('')}` : "Bomby: ";
  }

  function resetBombs() {
    bombs = 3;
    standardBombTimer = 0; // Zerowanie licznika opóźnienia bomb zwykłych przy restarcie

  }

  return {
    init,
    update,
    useBomb,
    getBombSymbols,
    resetBombs
  };
})();

// --- EFEKTY WIZUALNE BOMB ---

function drawFractalLightning(startX, startY, endX, endY, progress) {
  if (progress <= 0) return;
  let t = constrain(progress, 0, 1);
  let x = lerp(startX, endX, t);
  let y = lerp(startY, endY, t);
  let dx = endX - startX;
  let dy = endY - startY;
  let distance = sqrt(dx * dx + dy * dy);
  let steps = floor(distance / 10);
  let points = [{ x: startX, y: startY }];
  for (let i = 1; i < steps; i++) {
    let px = lerp(startX, endX, i / steps) + random(-5, 5);
    let py = lerp(startY, endY, i / steps) + random(-5, 5);
    points.push({ x: px, y: py });
    if (random() < 0.3) {
      let branchX = px + random(-10, 10);
      let branchY = py + random(-10, 10);
      points.push({ x: branchX, y: branchY });
      if (random() < 0.2) {
        let subBranchX = branchX + random(-5, 5);
        let subBranchY = branchY + random(-5, 5);
        points.push({ x: subBranchX, y: subBranchY });
      }
    }
  }
  points.push({ x: endX, y: endY });
  for (let i = 0; i < points.length - 1; i++) {
    line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
}