class Boss3_HydraNerwowa {
  constructor() {
    // --- STANDARD WEJŚCIA SILNIKA GRY ---
    this.x = width + 500; 
    this.y = height / 2;
    this.baseX = width - 200; // Docelowa pozycja walki na ekranie
    this.baseY = height / 2;
    
    this.state = 'entering'; // 'entering', 'battle', 'explosion'
    this.vx = -2.0;
    this.radius = 10;
    
    // --- PARAMETRY ŻYCIA BOSSA 3 ---
    this.coreHp = 3000; 
    this.maxCoreHp = 3000;
    this.points = 10000;
    
    this.isDead = false;
    this.exploded = false;
    this.explosionFrame = 0;
    this.explosionParticles = [];

    // System cząsteczek wizualnych
    this.sparkParticles = [];
    this.debrisParticles = [];
    
    // Bufor na wyklute Czerwone Kulki (dla bezpiecznego przekazania do poziomu)
    this.spawnQueue = [];

    // Ustawienie zasięgu pioruna w jednym miejscu
    this.lightningRange = 200;

    // --- FAZA 3: SYSTEMY OBRONNE ODSŁONIĘTEGO RDZENIA ---
    this.coreLightningState = 'idle'; // 'idle', 'targeting', 'striking'
    this.coreLightningTimer = 300;    // Pierwszy strzał po 5 sekundach od odsłonięcia
    this.coreTargetX = 0;
    this.coreTargetY = 0;
    this.coreStrikeTimer = 0;

    this.coreSpawnTimer = 600;        // Pierwszy spawn kulek po 10 sekundach
    this.spawnFromTop = true;         // Alternacja końcówek (góra / dół)

    // --- INICJALIZACJA 8 ATTAKUJĄCYCH MACEK ---
    this.tentacles = [];
    let spacings = [-280, -200, -120, -40, 40, 120, 200, 280];
    
    for(let i = 0; i < 8; i++) {
      this.tentacles.push({
        offY: spacings[i],
        phase: random(TWO_PI),       
        hp: 350,                      
        maxHp: 350,
        state: 'normal', // 'normal', 'targeting', 'lunging', 'returning', 'dead_cocoon', 'fully_dead'
        
        currentX: this.x - 180,
        currentY: this.y + spacings[i],
        targetX: 0, 
        targetY: 0,
        
        // życie pierwszych kokonów
        actionTimer: random([300, 600, 900]),
        cocoonHp: 300,
        cocoonTimer: 0
        // UWAGA aby ustawić, ile życia ma kokon po "wykluciu" znajdź linię t.cocoonHp = 200;  
      });
    }
  }

  // Zwraca aktywne punkty celownicze dla systemu Bomb (Klawisz B)
  getTargetableParts() {
    if (this.isDead) return [];
    
    // Gdy boss wybuchnie od atomówki, jego korpus musi wciąż udostępniać
    // współrzędne x i y dla animacji w rakieta.js, żeby uniknąć błędu "Cannot read properties of undefined (reading 'x')"!
    if (this.state === 'explosion') {
      return [{ x: this.x, y: this.y }];
    }

    let parts = [];
    let anyEyeAlive = false;
    let anyCocoonAlive = false;
    
    for (let t of this.tentacles) {
      if (t.state !== 'dead_cocoon' && t.state !== 'fully_dead') {
        parts.push({ x: t.currentX, y: t.currentY });
        anyEyeAlive = true;
      } else if (t.state === 'dead_cocoon') {
        parts.push({ x: this.x - 35, y: this.y + t.offY });
        anyCocoonAlive = true;
      }
    }
    
    // Korpus można namierzyć bombą tylko gdy oczy i kokony są martwe
    if (!anyEyeAlive && !anyCocoonAlive && this.coreHp > 0) {
      parts.push({ x: this.x, y: this.y });
    }
    return parts;
  }

  // Obsługa obrażeń od systemowej Bomby Plazmowej / Atomówki
  takeDamage(damage) {
    if (this.isDead || this.state === 'explosion') return false;
    let amt = damage || 15;

    for (let t of this.tentacles) {
      if (t.state !== 'dead_cocoon' && t.state !== 'fully_dead') {
        t.hp -= amt;
        this.createSparks(t.currentX, t.currentY);
        if (t.hp <= 0) this.triggerEyeDeath(t);
      } else if (t.state === 'dead_cocoon') {
        t.cocoonHp -= amt;
        this.createSparks(this.x - 35, this.y + t.offY);
        if (t.cocoonHp <= 0) t.state = 'fully_dead';
      }
    }

    let allFullyDead = this.tentacles.every(t => t.state === 'fully_dead');
    if (allFullyDead && this.coreHp > 0) {
      this.coreHp -= amt;
      this.createSparks(this.x, this.y);
    }

    // Bezpieczne wywołanie procedury eksplozji
    if (allFullyDead && this.coreHp <= 0 && !this.exploded) {
      this.startExplosion();
    }

    return true;
  }

  hits(playerObj) {
    if (this.isDead || this.state === 'explosion') return false;
    return dist(this.x, this.y, playerObj.x, playerObj.y) < (this.radius + playerObj.width/2);
  }

  handleCollision(playerObj) {
    if (this.isDead || this.state === 'explosion') return;
    if (typeof playerObj.takeDamage === 'function') {
      playerObj.takeDamage(15); 
      if (playerObj.shieldPower <= 0 && typeof playerObj.startExplosion === 'function') {
        playerObj.startExplosion();
      }
    }
  }

  triggerEyeDeath(t) {
    t.state = 'dead_cocoon';
    t.cocoonTimer = 900; // 15 sekund przy 60 FPS
    t.cocoonHp = 300;
    this.createDebris(t.currentX, t.currentY, color(255, 30, 30));

    // Tworzenie Czerwonej Kulki w miejscu zestrzelonego oka
    if (typeof Enemy3_czerwone_kulki === 'function') {
      let spawnedEye = new Enemy3_czerwone_kulki();
      spawnedEye.x = t.currentX;
      spawnedEye.y = t.currentY;
      
      this.spawnQueue.push(spawnedEye);

      if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
        enemies.push(spawnedEye);
      }
    }
  }

  update(player) {
    if (this.state === 'explosion') {
      this.updateExplosion();
      if (this.explosionFrame <= 0) {
        this.isDead = true; 
      }
      return;
    }

    // Cząsteczki fizyczne
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) { 
      let p = this.sparkParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= 15; 
      if (p.life <= 0) this.sparkParticles.splice(i, 1); 
    }
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) { 
      let p = this.debrisParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= 5; 
      if (p.life <= 0) this.debrisParticles.splice(i, 1); 
    }

    // --- FAZA 1: WEJŚCIE NA EKRAN ---
    if (this.state === 'entering') {
      this.x += this.vx;
      for (let t of this.tentacles) {
        t.currentX += this.vx;
      }
      if (this.x <= this.baseX) {
        this.x = this.baseX;
        this.state = 'battle';
      }
      return;
    }

    // --- URUCHOMIENIE OBRONY RDZENIA (Faza 3) ---
    let allFullyDead = this.tentacles.every(t => t.state === 'fully_dead');
    if (allFullyDead && this.coreHp > 0) {
      this.updateCoreDefense(player);
    }

    // --- FAZA 2: MASZYNA STANÓW WALKI ---
    for (let t of this.tentacles) {
      let homeX = this.x - 180 + sin(frameCount * 0.04 + t.phase) * 45;
      let homeY = this.y + t.offY + cos(frameCount * 0.03 + t.phase) * 55;

      if (t.state !== 'dead_cocoon' && t.state !== 'fully_dead') {
        if (player && dist(t.currentX, t.currentY, player.x, player.y) < this.lightningRange) {
          if (frameCount % 12 === 0 && !player.isImmortal) {
            player.takeDamage(5);
            if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
          }
        }
      }

      if (t.state === 'normal') {
        t.currentX = lerp(t.currentX, homeX, 0.06);
        t.currentY = lerp(t.currentY, homeY, 0.06);
        t.actionTimer--;

        if (t.actionTimer <= 0) {
          t.state = 'targeting';
          t.actionTimer = 60;
          if (player) { t.targetX = player.x; t.targetY = player.y; }
        }
      } 
      else if (t.state === 'targeting') {
        t.currentX = lerp(t.currentX, homeX, 0.06);
        t.currentY = lerp(t.currentY, homeY, 0.06);
        t.actionTimer--;
        if (t.actionTimer <= 0) t.state = 'lunging';
      } 
      else if (t.state === 'lunging') {
        t.currentX = lerp(t.currentX, t.targetX, 0.08);
        t.currentY = lerp(t.currentY, t.targetY, 0.08);
        if (dist(t.currentX, t.currentY, t.targetX, t.targetY) < 20) t.state = 'returning';
      }
      else if (t.state === 'returning') {
        t.currentX = lerp(t.currentX, homeX, 0.03);
        t.currentY = lerp(t.currentY, homeY, 0.03);
        if (dist(t.currentX, t.currentY, homeX, homeY) < 15) {
          t.state = 'normal';
          t.actionTimer = random([300, 600, 900]);
        }
      } 
      else if (t.state === 'dead_cocoon') {
        t.cocoonTimer--;
        if (t.cocoonTimer <= 0) {
          t.state = 'normal';
          t.hp = 350;
          t.actionTimer = random([300, 600, 900]);
          t.currentX = this.x - 40;
          t.currentY = this.y + t.offY;
          this.createDebris(this.x - 40, this.y + t.offY, color(0, 255, 120));
        }
      }
    }

    // --- FAZA 3: SAMOOBSŁUGA KOLIZJI Z POCISKAMI GRACZA ---
    if (player && player.bullets && Array.isArray(player.bullets)) {
      for (let j = player.bullets.length - 1; j >= 0; j--) {
        let b = player.bullets[j];
        let bRadius = b.width ? b.width/2 : 10;
        let hitDetected = false;

        for (let t of this.tentacles) {
          if (t.state !== 'dead_cocoon' && t.state !== 'fully_dead') {
            if (dist(b.x, b.y, t.currentX, t.currentY) < (24 + bRadius)) {
              t.hp -= b.power || 10;
              this.createSparks(b.x, b.y);
              hitDetected = true;
              if (t.hp <= 0) this.triggerEyeDeath(t);
              break;
            }
          } else if (t.state === 'dead_cocoon') {
            let cx = this.x - 35; let cy = this.y + t.offY;
            if (dist(b.x, b.y, cx, cy) < (18 + bRadius)) {
              t.cocoonHp -= b.power || 10;
              this.createSparks(b.x, b.y);
              hitDetected = true;
              if (t.cocoonHp <= 0) {
                t.state = 'fully_dead';
                this.createDebris(cx, cy, color(100, 20, 20));
              }
              break;
            }
          }
        }

        if (hitDetected) { player.bullets.splice(j, 1); continue; }

        let allFullyDead = this.tentacles.every(t => t.state === 'fully_dead');
        if (allFullyDead && this.coreHp > 0) {
          if (b.x > (this.x - 50) && b.x < (this.x + 50) && b.y > (this.y - 320) && b.y < (this.y + 320)) {
            this.coreHp -= b.power || 10;
            this.createSparks(b.x, b.y);
            player.bullets.splice(j, 1);
            this.checkDeathCondition();
          }
        }
      }
    }
  }

  checkDeathCondition() {
    let allFullyDead = this.tentacles.every(t => t.state === 'fully_dead');
    if (allFullyDead && this.coreHp <= 0 && !this.exploded) {
      this.startExplosion();
    }
  }

  show(localPlayer) {
    let playerObj = localPlayer || (typeof player !== 'undefined' ? player : null);

    if (this.state === 'explosion') {
      push(); 
      translate(this.x, this.y); 
      this.drawExplosion(); 
      pop();
      return;
    }

    push();
    
    // Cząsteczki trzęsienia
    for (let p of this.debrisParticles) { 
      fill(red(p.color), green(p.color), blue(p.color), p.life); noStroke(); 
      rect(p.x, p.y, p.size, p.size); 
    }

    let allFullyDead = this.tentacles.every(t => t.state === 'fully_dead');

    // Korpus bazowy
    // --- WYWOŁANIE NOWEGO SILNIKA RDZENIA BOSSA ---
    this.drawOptimizedInfectedHive(allFullyDead);

    // --- WIZUALIZACJA OBRONY RDZENIA (Faza 3) ---
    if (allFullyDead && this.coreHp > 0) {
      this.drawCoreDefense();
    }

    // Macki i Kokony
    for (let t of this.tentacles) {
      let waveX = this.getWaveOffset(t.offY);
      let cx = (this.x - 35) + waveX; // Kokony i nerwy płyną na fali roju!
      let cy = this.y + t.offY;       // Kokony i nerwy są tylko w stałej pozycji y, czyli pionowo się nieporuszają

      push(); translate(cx, cy);

      // --- NOWY KOD kokonu: JAJO XENOMORPHA ---
      let time = frameCount;
      let bloodPulse = (t.state === 'dead_cocoon') ? (sin(time * 0.18) * 0.5 + 0.5) : 0;
      let swell = (t.state === 'dead_cocoon') ? sin(time * 0.15) * 2.5 : 0;

      let fleshColor, veinColor, highlightAlpha;

      // Dopasowanie kolorów do stanu macki (żywa, pulsująca, martwa)
      if (t.state === 'dead_cocoon') {
        fleshColor = color(245, 145, 150);
        veinColor = lerpColor(color(200, 0, 0), color(255, 40, 50), bloodPulse);
        highlightAlpha = 160;
      } else if (t.state === 'fully_dead') {
        fleshColor = color(155, 120, 95);
        veinColor = color(85, 55, 40);
        highlightAlpha = 15;
      } else { 
        // Wszystkie stany żywe (normal, targeting, lunging, returning)
        fleshColor = color(225, 135, 140);
        veinColor = color(150, 20, 35);
        highlightAlpha = 110;
      }

      // Baza mięsna
      noStroke(); fill(fleshColor);
      ellipse(0, 0, 46 + swell, 34 + swell); 

      // Oplot żylny (Krzywe Beziera - rzutowane poziomo, podstawa z prawej)
      noFill(); stroke(veinColor); strokeWeight(t.state === 'dead_cocoon' ? 3 : 2);
      
      // żyła górna
      bezier(22, -8,  5, -25,  -10, -20,  -22, -4); 
      
      // żyła dolna
      bezier(22, 8,   5, 25,   -10, 20,   -22, 4);  
      
      strokeWeight(1.5);
      
      // środkowa żyła
      bezier(22, 0,   2, -8,   -8, 10,    -22, 0);

      // Mokry, śliski refleks światła (dostosowany do orientacji poziomej)
      if (highlightAlpha > 20) {
        push();
        noStroke(); fill(255, 255, 255, highlightAlpha);
        translate(-13, -7); 
        rotate(-0.1); 
        ellipse(0, 0, 12, 5); 
        pop();
      }
      // --- KONIEC NOWEGO KODU ---
      pop();

      if (t.state === 'dead_cocoon' || t.state === 'fully_dead') continue;

      // Nerwy
      noFill(); stroke(150, 25, 45); strokeWeight(14);
      bezier(cx, cy, cx - 60, cy, t.currentX + 80, t.currentY, t.currentX, t.currentY);
      stroke(255, 140, 140, 160); strokeWeight(3);
      bezier(cx, cy, cx - 60, cy, t.currentX + 80, t.currentY, t.currentX, t.currentY);

      if (playerObj && dist(t.currentX, t.currentY, playerObj.x, playerObj.y) < this.lightningRange) {
        push();
        stroke(255, 0, 0, 70); strokeWeight(7); line(t.currentX, t.currentY, playerObj.x, playerObj.y);
        stroke(255, 130, 130); strokeWeight(2.2); noFill();
        beginShape();
        vertex(t.currentX, t.currentY);
        let steps = 5;
        for (let s = 1; s < steps; s++) {
          let pr = s / steps;
          let zx = lerp(t.currentX, playerObj.x, pr) + random(-11, 11);
          let zy = lerp(t.currentY, playerObj.y, pr) + random(-11, 11);
          vertex(zx, zy);
        }
        vertex(playerObj.x, playerObj.y);
        endShape();
        pop();
      }

      if (t.state === 'targeting' && playerObj) {
        stroke(255, 0, 0, 90); strokeWeight(1.5); line(t.currentX, t.currentY, t.targetX, t.targetY);
        noFill(); stroke(255, 0, 0, 200); ellipse(t.targetX, t.targetY, 35 - (60 - t.actionTimer)/2);
      }

      // Gałka oczna
      push(); 
      translate(t.currentX, t.currentY);
      let ang = playerObj ? atan2(playerObj.y - t.currentY, playerObj.x - t.currentX) : 0;

      stroke(100, 0, 0, 200); strokeWeight(2); noFill(); ellipse(0, 0, 42); 
      noStroke();
      fill(t.state === 'lunging' ? color(255, 100, 100) : color(255, 235, 220)); 
      ellipse(0, 0, 36);

      stroke(200, 0, 0, 120 + sin(frameCount * 0.15) * 80); strokeWeight(1);
      for(let k = 0; k < 8; k++) {
        let a = (TWO_PI / 8) * k + (sin(frameCount * 0.05 + k) * 0.15); 
        line(cos(a) * 6, sin(a) * 6, cos(a) * 17, sin(a) * 17);
        let aSub = a + 0.15;
        line(cos(aSub) * 11, sin(aSub) * 11, cos(aSub) * 16, sin(aSub) * 16);
      }

      let pSize = (t.state === 'lunging') ? 12 : 6; 
      let lx = cos(ang) * 8; let ly = sin(ang) * 8;

      push(); translate(lx, ly); noStroke();
      fill(0, 255, 200, 80); ellipse(0, 0, pSize + 12); 
      fill(0, 255, 200);     ellipse(0, 0, pSize + 4);  
      fill(0);               ellipse(0, 0, pSize);      
      fill(255, 200);        ellipse(-pSize / 4, -pSize / 4, 2, 2); 
      pop(); pop(); 
    }

    for (let p of this.sparkParticles) { 
      fill(255, 200, 50, p.life); noStroke(); ellipse(p.x, p.y, 4, 4); 
    }
    
    pop();
    this.drawEngineUI();
  }

  createSparks(x, y) {
    for (let i = 0; i < 6; i++) {
      this.sparkParticles.push({ x, y, vx: random(-3,3), vy: random(-3,3), life: 255 });
    }
  }

  createDebris(x, y, col) {
    for (let i = 0; i < 12; i++) {
      this.debrisParticles.push({ x, y, vx: random(-4,4), vy: random(-4,4), size: random(3,7), color: col, life: 255 });
    }
  }

  drawEngineUI() {
    let barW = 220; let barH = 6;
    let centerX = width * 0.85; let y = 70;

    push();
    noStroke(); fill(20, 20, 30, 200); rect(centerX - barW/2, y, barW, barH);
    let currentW = map(this.coreHp, 0, this.maxCoreHp, 0, barW);
    fill(this.coreHp > 50 ? color(0, 255, 150) : color(255, 50, 50));
    rect(centerX - barW/2, y, currentW, barH);

    stroke(255, 80); strokeWeight(1); noFill(); rect(centerX - barW/2 - 1, y - 1, barW + 2, barH + 2);

    fill(255); noStroke(); textSize(13); textAlign(CENTER, BOTTOM);
    text("HYDRA NERWOWA", centerX, y - 8);
    pop();
  }

  // PROCEDURY EKSPLOZJI
  startExplosion() {
    this.state = 'explosion';
    this.explosionFrame = 170;
    this.createExplosion();
    this.exploded = true;
    if (typeof playEnemyExplosion === 'function') playEnemyExplosion();
  }

  createExplosion() {
    for (let i = 0; i < 350; i++) {
      let angle = random(TWO_PI); let speed = random(1, 14);
      this.explosionParticles.push({
        x: 0, y: 0, vx: cos(angle)*speed, vy: sin(angle)*speed, size: random(2, 5), life: 255,
        col: random() > 0.4 ? color(255, 40, 40) : color(255, 180, 0)
      });
    }
  }

  updateExplosion() {
    this.explosionFrame--;
    for (let p of this.explosionParticles) { p.x += p.vx; p.y += p.vy; p.life -= 1.5; }
  }

  drawExplosion() {
    for (let p of this.explosionParticles) {
      if (p.life <= 0) continue;
      stroke(red(p.col), green(p.col), blue(p.col), p.life); strokeWeight(p.size); point(p.x, p.y);
    }
  }

  // =====================================================================
  // LOGIKA I GRAFIKA OBRONY RDZENIA (Faza 3)
  // =====================================================================
  updateCoreDefense(player) {
    // 1. ATAK PIORUNOWY Z KOŃCÓWEK (cykl co 10s)
    if (this.coreLightningState === 'idle') {
      this.coreLightningTimer--;
      if (this.coreLightningTimer <= 0) {
        this.coreLightningState = 'targeting';
        this.coreLightningTimer = 60; // 1 sekunda celowania czerwonym laserem
        if (player) {
          this.coreTargetX = player.x;
          this.coreTargetY = player.y;
        }
      }
    } else if (this.coreLightningState === 'targeting') {
      this.coreLightningTimer--;
      if (this.coreLightningTimer <= 0) {
        this.coreLightningState = 'striking';
        this.coreStrikeTimer = 25; // Piorun bije przez ok. 0.4 sekundy
        if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
      }
    } else if (this.coreLightningState === 'striking') {
      this.coreStrikeTimer--;
      if (player && !player.isImmortal) {
        if (dist(player.x, player.y, this.coreTargetX, this.coreTargetY) < 45) {
          player.takeDamage(15);
        }
      }
      if (this.coreStrikeTimer <= 0) {
        this.coreLightningState = 'idle';
        this.coreLightningTimer = 600; 
      }
    }

    // 2. WYSTRZAŁ OCZU W KOSMOS (cykl co 10s)
    this.coreSpawnTimer--;
    if (this.coreSpawnTimer <= 0) {
      this.spawnCoreEye();
      this.coreSpawnTimer = 600; 
    }
  }

  spawnCoreEye() {
    let tipYOffset = this.spawnFromTop ? -310 : 310;
    let waveX = this.getWaveOffset(tipYOffset);
    let spawnX = this.x + waveX - 20;
    let spawnY = this.y + tipYOffset;

    this.createDebris(spawnX, spawnY, color(255, 50, 50));

    if (typeof Enemy3_czerwone_kulki === 'function') {
      let spawnedEye = new Enemy3_czerwone_kulki();
      spawnedEye.x = spawnX;
      spawnedEye.y = spawnY;
      
      this.spawnQueue.push(spawnedEye);

      if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
        enemies.push(spawnedEye);
      }
    }
    this.spawnFromTop = !this.spawnFromTop; // Naprzemiennie: raz góra, raz dół
  }

  drawCoreDefense() {
    push();
    let topX = this.x + this.getWaveOffset(-310);
    let topY = this.y - 310;
    let btmX = this.x + this.getWaveOffset(310);
    let btmY = this.y + 310;

    if (this.coreLightningState === 'targeting') {
      stroke(255, 0, 0, 120); strokeWeight(1.5);
      line(topX, topY, this.coreTargetX, this.coreTargetY);
      line(btmX, btmY, this.coreTargetX, this.coreTargetY);

      noFill(); stroke(255, 30, 30, 220);
      let shrink = map(this.coreLightningTimer, 60, 0, 50, 5);
      ellipse(this.coreTargetX, this.coreTargetY, 10, 10); // Stałe kółko o średnicy 10px
    } 
    else if (this.coreLightningState === 'striking') {
      this.drawJaggedCoreRay(topX, topY, this.coreTargetX, this.coreTargetY);
      this.drawJaggedCoreRay(btmX, btmY, this.coreTargetX, this.coreTargetY);

      noStroke(); fill(255, 50, 50, 180 + random(-50, 50));
      ellipse(this.coreTargetX, this.coreTargetY, 70, 70);
      fill(255, 200, 200);
      ellipse(this.coreTargetX, this.coreTargetY, 30, 30);
    }
    pop();
  }

  drawJaggedCoreRay(x1, y1, x2, y2) {
    push();
    stroke(255, 0, 40, 80); strokeWeight(8); line(x1, y1, x2, y2);
    stroke(255, 80, 80); strokeWeight(2.5); noFill();
    beginShape();
    vertex(x1, y1);
    let steps = 7;
    for (let s = 1; s < steps; s++) {
      let pr = s / steps;
      let zx = lerp(x1, x2, pr) + random(-18, 18);
      let zy = lerp(y1, y2, pr) + random(-18, 18);
      vertex(zx, zy);
    }
    vertex(x2, y2);
    endShape();
    pop();
  }

  // =====================================================================
  // SILNIK WYGLĄDU RDZENIA BOSSA (Zainfekowany Rój 75% CPU Optimized)
  // =====================================================================
  getWaveOffset(y) {
    return sin(frameCount * 0.035 + y * 0.007) * 14;
  }

  drawOptimizedInfectedHive(exposed) {
    push();
    translate(this.x, this.y); 

    let f = frameCount;
    let glowCol  = exposed ? color(255, 10, 40, 70 + sin(f*0.2)*35) : color(140, 10, 25, 40);
    let midCol   = exposed ? color(255, 40, 60, 200)               : color(180, 20, 35, 130);
    let sharpCol = exposed ? color(255, 180, 190, 255)             : color(210, 140, 150, 160);

    noStroke();
    let step = 8;
    for (let y = -330; y <= 330; y += step) {
      let normY = y / 330;
      let baseW = 120 * sqrt(max(0, 1 - normY * normY));
      let wx = this.getWaveOffset(y);

      fill(glowCol);  ellipse(wx, y, baseW + 28, step + 6); 
      fill(midCol);   ellipse(wx, y, baseW + 16, step + 4); 
      fill(sharpCol); ellipse(wx, y, baseW + 6,  step + 2); 

      fill(8, 8, 11);
      ellipse(wx, y, baseW, step + 4);

      if (exposed && abs(y) <= 300) {
        let maxCoreW = 56 * sqrt(max(0, 1 - (y/300) * (y/300)));
        let boil = sin(f * 0.18 + y * 0.04) * 8;
        let rIntensity = 190 + sin(f * 0.1 + y * 0.05) * 65;

        fill(rIntensity, 15, 35, 200);
        ellipse(wx, y, maxCoreW + boil, step + 6);
        fill(255, 140, 70, 230);
        ellipse(wx, y, maxCoreW * 0.45, step);
      }
    }

    let gap = exposed ? 34 : 0; 
    for (let y = -310; y <= 310; y += 38) {
      let wx = this.getWaveOffset(y); 
      let edgeX = max(18, 60 * sqrt(max(0, 1 - (y/330) * (y/330))));

      fill(14, 16, 19); stroke(2, 2, 4); strokeWeight(2);
      beginShape();
      vertex(wx - edgeX, y - 6); vertex(wx - gap, y + 8);
      vertex(wx - gap, y + 34);  vertex(wx - edgeX, y + 24);
      endShape(CLOSE);
      
      beginShape();
      vertex(wx + gap, y + 8);   vertex(wx + edgeX, y - 6);
      vertex(wx + edgeX, y + 24);vertex(wx + gap, y + 34);
      endShape(CLOSE);

      noStroke(); fill(105, 118, 135, 100);
      stroke(115, 128, 145, 130); strokeWeight(1.5);
      line(wx - edgeX + 3, y - 2, wx - gap - 1, y + 10);
      line(wx + gap + 1, y + 10, wx + edgeX - 3, y - 2);
      noStroke();

      stroke(175, 18, 28, 230); strokeWeight(3.5); noFill();
      bezier(wx - edgeX, y + 12, wx - edgeX * 0.4, y + 24, wx - edgeX * 0.7, y - 4, wx - gap, y + 14);
      bezier(wx + edgeX, y + 22, wx + edgeX * 0.4, y + 4, wx + edgeX * 0.6, y + 30, wx + gap, y + 18);
      
      stroke(255, 60, 70, 140); strokeWeight(1);
      line(wx - edgeX + 10, y + 13, wx - gap - 5, y + 15);
      line(wx + gap + 5, y + 19, wx + edgeX - 10, y + 21);

      if (!exposed) {
        noStroke();
        let nodePulse = sin(f * 0.08 + y * 0.15) * 3.5;
        fill(245, 30, 45, 140 + sin(f * 0.1 + y * 0.05) * 115);
        ellipse(wx, y + 15, 10 + nodePulse, 18 + nodePulse);
        fill(255, 210, 210, 225);
        ellipse(wx, y + 15, 3, 6);
      }
    }
    pop();
  }
}