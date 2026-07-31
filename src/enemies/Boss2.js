class Boss2_OrbitalnyStraznik {
  constructor() {
    // --- DOPASOWANIE DO WZORCA MATRIARKI (Spawn poza ekranem) ---
    this.x = width + 500; 
    this.y = height / 2;
    this.state = 'entering'; 
    
    this.vx = -1.5;
    this.vy = 0;
    this.radius = 120;
    
    // Punkty życia poszczególnych sekcji
    this.shieldHp = 400;   
   
    this.armorHp = [400, 400, 400, 400]; 
    this.gearHp = [400, 400, 400, 400, 400, 400, 400, 400];  
    
    this.points = 2500; 
    this.isDead = false;

    this.shieldOrbit = 0;
    this.shieldDist = 140;

    // --- NOWE: Timery i współrzędne dla Trybu Pogoni ---
    this.chaseTimer = 0;       // Odlicza 10 sekund (600 klatek) do kolejnej pogoni
    this.chaseSubTimer = 0;    // Odlicza czas wewnątrz stanów pogoni (np. 1 sekunda ładowania)
    this.targetX = 0;          // Zapamiętana pozycja X gracza do ataku
    this.targetY = 0;          // Zapamiętana pozycja Y gracza do ataku

    // Tablice stanów i timerów AI dla 8 dział
    this.cannonStates = ['idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle'];
    this.cannonTimers = [0, 0, 0, 0, 0, 0, 0, 0];
    this.bossBullets = [];

    this.sparkParticles = [];
    this.debrisParticles = [];

    // System obronnego pioruna Tesli
    this.lightningTimer = 0;      // Odlicza 0.5s trwania błysku (30 klatek)
    this.lightningCooldown = 0;   // Odlicza czas do ponownego naładowania (np. 150 klatek = 2.5s)
    this.zapTarget = { x: 0, y: 0 };

    this.exploded = false;
    this.explosionFrame = 0;
    this.explosionParticles = []; // Oddzielna tablica dla wielkiej eksplozji

  }

  createSparks(x, y) {
    for (let i = 0; i < 5; i++) {
      this.sparkParticles.push({
        x: x, y: y,
        vx: random(-3, 3), vy: random(-3, 3),
        life: 255
      });
    }
  }

  createDebris(x, y, col) {
    for (let i = 0; i < 15; i++) {
      this.debrisParticles.push({
        x: x, y: y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random(3, 8),
        color: col,
        life: 255
      });
    }
  }

  getColorForHealth(hp) {
    if (hp <= 0) return color(50, 50, 50, 50);
    if (hp < 100) return color(255, 0, 50);
    if (hp < 200) return color(255, 150, 0);
    return color(0, 255, 255);
  }

  hits(target) {
    if (this.isDead || this.state === 'explosion') return false;
    let d = dist(this.x, this.y, target.x, target.y);
    let targetRadius = target.width ? target.width / 2 : (target.radius || 20);
    return d < (this.radius + targetRadius);
  }

  handleCollision(playerObj) {
    if (this.isDead || this.state === 'explosion') return;
    if (typeof playerObj.takeDamage === 'function') {
      playerObj.takeDamage(15); 
      if (playerObj.shieldPower <= 0) {
        playerObj.startExplosion();
      }
    }
  }

  takeDamage(damage) {
    // 1. Zabezpieczenie przed zadawaniem obrażeń wrakowi
    if (this.isDead || this.state === 'explosion') return false;
    let amt = damage || 10;
    
    // 2. Tarcza i Rdzeń
    if (this.shieldHp > 0) {
      this.shieldHp -= amt;
      this.createSparks(this.x, this.y);
      if (this.shieldHp <= 0) this.createDebris(this.x, this.y, color(0, 255, 220));
    } 

    // 3. Obrażenia obszarowe dla 4 Pancerzy
    for (let i = 0; i < 4; i++) {
      if (this.armorHp[i] > 0) {
        this.armorHp[i] -= amt;
        
        // Obliczanie fizycznej pozycji pancerza, aby iskry sypały się w odpowiednim miejscu
        let armorAngle = i * HALF_PI + this.shieldOrbit;
        let ax = this.x + cos(armorAngle) * this.radius;
        let ay = this.y + sin(armorAngle) * this.radius;
        
        this.createSparks(ax, ay);
        if (this.armorHp[i] <= 0) {
          this.createDebris(ax, ay, color(30, 45, 70));
        }
      }
    }

    // 4. Obrażenia obszarowe dla 8 Dział
    for (let i = 0; i < 8; i++) {
      if (this.gearHp[i] > 0) {
        this.gearHp[i] -= amt;
        
        // Obliczanie fizycznej pozycji działa
        let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
        let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
        let gx = this.x + cos(gearAngle) * distFromCenter;
        let gy = this.y + sin(gearAngle) * distFromCenter;
        
        this.createSparks(gx, gy);
        if (this.gearHp[i] <= 0) {
          this.createDebris(gx, gy, color(0, 255, 120));
        }
      }
    }

    // 5. Sprawdzenie, czy bomba zniszczyła dosłownie wszystko naraz
    let allPartsDestroyed = (this.shieldHp <= 0);
    for (let i = 0; i < 4; i++) {
      if (this.armorHp[i] > 0) allPartsDestroyed = false;
    }
    for (let i = 0; i < 8; i++) {
      if (this.gearHp[i] > 0) allPartsDestroyed = false;
    }

    // Zamiast natychmiastowej śmierci - odpalamy spektakularny wybuch z poprzedniego kroku
    if (allPartsDestroyed && !this.exploded) {

      this.startExplosion();
      return true; 
    }

    return false;
  }

  // Zwraca tablicę współrzędnych {x, y} wszystkich aktywnych modułów Bossa aby bomby wiedziały gdzie mają się rysować
  getTargetableParts() {
    if (this.isDead || this.state === 'explosion') return [];
    
    let parts = [];
    
    // 1. Rdzeń (środek)
    if (this.shieldHp > 0) {
      parts.push({ x: this.x, y: this.y });
    }

    // 2. Współrzędne 4 Pancerzy
    for (let i = 0; i < 4; i++) {
      if (this.armorHp[i] > 0) {
        let armorAngle = i * HALF_PI + this.shieldOrbit;
        parts.push({
          x: this.x + cos(armorAngle) * this.radius,
          y: this.y + sin(armorAngle) * this.radius
        });
      }
    }

    // 3. Współrzędne 8 Dział
    for (let i = 0; i < 8; i++) {
      if (this.gearHp[i] > 0) {
        let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
        let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
        parts.push({
          x: this.x + cos(gearAngle) * distFromCenter,
          y: this.y + sin(gearAngle) * distFromCenter
        });
      }
    }

    return parts;
  }

  update(player) {

    // przeryewa wszystkie rutyny walki (latające tarcze, strzelanie), podczas gdy boss płonie, i zacznie odliczać klatki zniszczenia
    if (this.state === 'explosion') {
      this.updateExplosion();
      // Jeśli klatki wybuchu zeszły do zera, ostatecznie zgłaszamy grze śmierć:
      if (this.explosionFrame <= 0) {
        this.isDead = true; 
      }
      return; // Przerywa resztę logiki Bossa (nie strzela, nie lata)
    }

    // Aktualizacja cząsteczek i pocisków bossa
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) { 
      let p = this.sparkParticles[i]; 
      p.x += p.vx; p.y += p.vy; p.life -= 15; 
      if (p.life <= 0) this.sparkParticles.splice(i, 1); 
    }
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) { 
      let p = this.debrisParticles[i]; 
      p.x += p.vx; p.y += p.vy; p.life -= 4; 
      if (p.life <= 0) this.debrisParticles.splice(i, 1); 
    }
    
    for (let i = this.bossBullets.length - 1; i >= 0; i--) { 
      let b = this.bossBullets[i]; 
      b.x += b.vx; b.y += b.vy; 

      // Zapisywanie śladu w pętli ruchu
      b.history.push({ x: b.x, y: b.y });
      if (b.history.length > 20) b.history.shift();
      
      let d = dist(b.x, b.y, player.x, player.y);
      if (d < (player.width / 2 + 8) && !player.isImmortal) {
        player.takeDamage(15);
        this.bossBullets.splice(i, 1);
        if (player.shieldPower <= 0) {
          player.startExplosion();
        }
        continue;
      }

      if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
        this.bossBullets.splice(i, 1); 
      }
    }

    if (this.isDead) return;

    // --- LOGIKA ZIELONEGO PIORUNA ---
    if (this.lightningCooldown > 0) this.lightningCooldown--;

    if (this.lightningTimer > 0) {
      this.lightningTimer--;
      // Piorun "trzyma" cel i aktualizuje pozycję gracza w locie!
      this.zapTarget = { x: player.x, y: player.y }; 
    } else if (this.lightningCooldown === 0 && !this.isDead) {
      let d = dist(this.x, this.y, player.x, player.y);
      if (d < 350 && !player.isImmortal) {  // wartość 350 to promień zielonego pioruna
        this.lightningTimer = 30;     // Odpal piorun na 30 klatek (0.5 sekundy)
        this.lightningCooldown = 180; // Przeładowanie: 3 sekundy
        this.zapTarget = { x: player.x, y: player.y };
        
        player.takeDamage(15);        // Szok elektryczny zabiera 15% tarczy
        playBomb2Sound()  // dżwięk bomby piorun
        if (player.shieldPower <= 0 && typeof player.startExplosion === 'function') {
          player.startExplosion();
        }
      }
    }

    // --- MASZYNA STANÓW RUCHU BOSSA ---
    
    // 1. Stan wejścia na ekran
    if (this.state === 'entering') {
      this.x += this.vx;
      let targetEntranceX = width - 250; 
      if (this.x <= targetEntranceX) {
        this.x = targetEntranceX;
        this.state = 'battle';
        this.vx = 1.5; 
        this.chaseTimer = 0;
      }
      this.shieldOrbit += 0.02;
    } 
    
    // 2. Standardowa walka (typowy ruch)
    else if (this.state === 'battle') {
      this.chaseTimer++; // Zwiększanie licznika pogoni
      
      let leftLimit = width / 2 + 240; 
      let rightLimit = width - 240;
      let topLimit = 220; 
      let bottomLimit = height - 220;

      this.x += this.vx; 
      if (this.x < leftLimit) { this.x = leftLimit; this.vx *= -1; } 
      if (this.x > rightLimit) { this.x = rightLimit; this.vx *= -1; } 
      if (frameCount % 60 === 0) { 
        this.vx += random(-0.8, 0.8); 
        this.vx = constrain(this.vx, -2.5, 2.5); 
      }

      let targetY = map(player.y, 0, height, bottomLimit, topLimit);
      this.vy = (targetY - this.y) * 0.04; 
      this.y += this.vy;
      
      this.shieldOrbit += 0.02; // Normalna prędkość obrotu

      // Warunek uruchomienia trybu pogoni po 10 sekundach (600 klatek)
      if (this.chaseTimer >= 600) {
        this.state = 'chase_charge';
        this.chaseSubTimer = 0;
      }
    } 
    
    // 3. TRYB POGONI: Faza 1 - Ładowanie (2x szybsze wirowanie, sekunda przestoju)
    else if (this.state === 'chase_charge') {
      this.chaseSubTimer++;
      this.shieldOrbit += 0.04; // 2x szybsze wirowanie orbit!
      
      // Płynne wyhamowanie przed skokiem
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx;
      this.y += this.vy;

      if (this.chaseSubTimer >= 60) { // Po dokładnie 1 sekundzie (60 klatkach)
        // Namierzanie aktualnej pozycji rakiety gracza
        this.targetX = player.x;
        this.targetY = player.y;
        
        // Wyliczanie wektora kierunkowego szarży
        let angle = atan2(this.targetY - this.y, this.targetX - this.x);
        let attackSpeed = 7.5; // Dobrana stała prędkość szarży pościgu
        this.vx = cos(angle) * attackSpeed;
        this.vy = sin(angle) * attackSpeed;
        
        this.state = 'chase_dash';
        this.chaseSubTimer = 0;
      }
    } 
    
    // 4. TRYB POGONI: Faza 2 - Szarża (Ruch w zapamiętany punkt)
    else if (this.state === 'chase_dash') {
      this.shieldOrbit += 0.04; // Utrzymujemy szybkie obroty podczas lotu
      this.x += this.vx;
      this.y += this.vy;
      this.chaseSubTimer++;

      // Warunek zakończenia szarży: blisko punktu docelowego lub przekroczenie czasu maksymalnego (zabezpieczenie)
      let d = dist(this.x, this.y, this.targetX, this.targetY);
      if (d < 25 || this.chaseSubTimer > 180) {
        this.state = 'chase_return';
      }
    } 
    
    // 5. TRYB POGONI: Faza 3 - Powrót na prawą flankę ekranu
    else if (this.state === 'chase_return') {
      this.shieldOrbit += 0.02; // Powrót do standardowej prędkości wirowania
      
      let homeX = width - 250;
      let homeY = height / 2;
      
      let angle = atan2(homeY - this.y, homeX - this.x);
      let returnSpeed = 4.5;
      this.vx = cos(angle) * returnSpeed;
      this.vy = sin(angle) * returnSpeed;
      
      this.x += this.vx;
      this.y += this.vy;

      // Gdy powróci dostatecznie blisko swojej standardowej strefy walki
      if (dist(this.x, this.y, homeX, this.y) < 30) {
        this.state = 'battle';
        this.chaseTimer = 0; // Reset głównego timera 10 sekund
        this.vx = 1.5;       // Przywrócenie bazowej prędkości
      }
    }

    // --- SYSTEMY OSTRZAŁU AI DZIAŁ ---
    for (let i = 0; i < 8; i++) {
      if (this.gearHp[i] > 0) {
        this.cannonTimers[i]++;
        
        // KROK 1: Wyjście z długiego spoczynku -> odpalamy celownik
        if (this.cannonStates[i] === 'idle' && this.cannonTimers[i] >= 240) { 
          this.cannonStates[i] = 'targeting'; 
          this.cannonTimers[i] = 0; 
        }
        
        // KROK 2: Laser wycelował (60 klatek) -> STRZAŁ NR 1 -> idziemy na 2 sekundy przerwy
        else if (this.cannonStates[i] === 'targeting' && this.cannonTimers[i] >= 60) { 
          let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
          let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
          
          let absGx = this.x + cos(gearAngle) * distFromCenter;
          let absGy = this.y + sin(gearAngle) * distFromCenter;
          let fireAngle = atan2(player.y - absGy, player.x - absGx);
          
          this.bossBullets.push({
            x: absGx, 
            y: absGy, 
            vx: cos(fireAngle) * 5.5, 
            vy: sin(fireAngle) * 5.5,
            history: [],
            sparks: []
          });
          
          this.cannonStates[i] = 'pause'; // <--- Przełączamy w stan głuchej przerwy
          this.cannonTimers[i] = 0;
        }
        
        // KROK 3: Minęły 2 sekundy ciszy (120 klatek) -> STRZAŁ NR 2 -> koniec cyklu (sen)
        else if (this.cannonStates[i] === 'pause' && this.cannonTimers[i] >= 120) {
          let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
          let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
          
          let absGx = this.x + cos(gearAngle) * distFromCenter;
          let absGy = this.y + sin(gearAngle) * distFromCenter;
          let fireAngle = atan2(player.y - absGy, player.x - absGx);
          
          this.bossBullets.push({
            x: absGx, 
            y: absGy, 
            vx: cos(fireAngle) * 5.5, 
            vy: sin(fireAngle) * 5.5,
            history: [],
            sparks: []
          });

          this.cannonStates[i] = 'idle'; // <--- Cykl zamknięty, działo zapada w sen na 240 klatek
          this.cannonTimers[i] = 0;
        }

      } else {
        this.cannonStates[i] = 'idle';
      }
    }

    // --- KOLIZJE Z POCISKAMI GRACZA ---
    if (typeof player.bullets !== 'undefined') {
      for (let j = player.bullets.length - 1; j >= 0; j--) {
        let b = player.bullets[j]; 
        let hitDetected = false;
        
        for (let i = 0; i < 8; i++) { 
          if (this.gearHp[i] <= 0) continue;

          let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
          let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
          
          let gx = this.x + cos(gearAngle) * distFromCenter;
          let gy = this.y + sin(gearAngle) * distFromCenter;
          
          if (dist(b.x, b.y, gx, gy) < 60) { 
            this.gearHp[i] -= b.power || 10; 
            this.createSparks(b.x, b.y); 
            if (this.gearHp[i] <= 0) {
              this.createDebris(gx, gy, color(0, 255, 120)); 
            }
            hitDetected = true; 
            break; 
          } 
        }
        if (hitDetected) { player.bullets.splice(j, 1); continue; }
        
        for (let i = 0; i < 4; i++) { 
          if (this.armorHp[i] <= 0) continue;

          let armorAngle = i * HALF_PI + this.shieldOrbit;
          let bulletDist = dist(b.x, b.y, this.x, this.y);
          let bulletAngle = atan2(b.y - this.y, b.x - this.x);
          let angleDiff = atan2(sin(bulletAngle - armorAngle), cos(bulletAngle - armorAngle));

          if (bulletDist >= this.radius * 0.85 && bulletDist <= this.radius * 1.15 && abs(angleDiff) <= 0.41) { 
            this.armorHp[i] -= b.power || 10; 
            this.createSparks(b.x, b.y); 
            
            if (this.armorHp[i] <= 0) {
              let ax = this.x + cos(armorAngle) * this.radius;
              let ay = this.y + sin(armorAngle) * this.radius;
              this.createDebris(ax, ay, color(30, 45, 70)); 
            }
            hitDetected = true; 
            break; 
          } 
        }
        if (hitDetected) { player.bullets.splice(j, 1); continue; }
        
        if (dist(b.x, b.y, this.x, this.y) < this.radius * 0.7) {
          if (this.shieldHp > 0) {
            this.shieldHp -= b.power || 10; 
            this.createSparks(b.x, b.y);
            if (this.shieldHp <= 0) this.createDebris(this.x, this.y, color(0, 255, 220));
            player.bullets.splice(j, 1);
          }
        }
      }
    }

    // Warunek całkowitego pokonania
    let allPartsDestroyed = (this.shieldHp <= 0);
    for (let i = 0; i < 4; i++) {
      if (this.armorHp[i] > 0) allPartsDestroyed = false;
    }
    for (let i = 0; i < 8; i++) {
      if (this.gearHp[i] > 0) allPartsDestroyed = false;
    }

    if (allPartsDestroyed && !this.exploded) {

     this.startExplosion();
    }
  }

  show(localPlayer) {
    let playerObj = localPlayer || (typeof player !== 'undefined' ? player : null);

    // rysowanie wybuchu zamiast Bossa
    if (this.state === 'explosion') {
      push();
      translate(this.x, this.y);
      this.drawExplosion();
      pop();
      return; // Ukrywa starą grafikę całego Bossa!
    }

    for (let p of this.debrisParticles) { 
      let rCol = red(p.color);
      let gCol = green(p.color);
      let bCol = blue(p.color);
      fill(rCol, gCol, bCol, p.life); 
      noStroke(); 
      rect(p.x, p.y, p.size, p.size); 
    } 
    pop();

    // Rysowanie pocisków bossa (Sposób 2: Delikatne iskrzenie)
    push(); 
    for (let b of this.bossBullets) { 
      // 1. Rysowanie ogona
      for (let i = 0; i < b.history.length; i++) {
        let pos = b.history[i];
        let alpha = map(i, 0, b.history.length, 0, 150);
        fill(0, 200, 100, alpha);
        noStroke();
        ellipse(pos.x, pos.y, i * 0.6);
      }

      // 2. Generowanie i rysowanie iskier
      if (random() < 0.3) {
        b.sparks.push({x: b.x, y: b.y, life: 20, vx: random(-1,1), vy: random(-1,1)});
      }
      
      for (let s = b.sparks.length - 1; s >= 0; s--) {
        let sp = b.sparks[s];
        sp.x += sp.vx; 
        sp.y += sp.vy; 
        sp.life--;
        fill(180, 255, 180, sp.life * 10);
        noStroke();
        ellipse(sp.x, sp.y, 3);
        if (sp.life <= 0) b.sparks.splice(s, 1);
      }

      // 3. Rdzeń pocisku
      fill(180, 255, 180);
      noStroke();
      ellipse(b.x, b.y, 10);
    } 
    pop();

    if (this.isDead) return;

    // Linie celownicze dział
    push(); 
    if (playerObj) { 
      for (let i = 0; i < 8; i++) { 
        if (this.gearHp[i] > 0 && this.cannonStates[i] === 'targeting') { 
          let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
          let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
          
          let absGx = this.x + cos(gearAngle) * distFromCenter;
          let absGy = this.y + sin(gearAngle) * distFromCenter;
          stroke(0, 255, 80, 180); 
          strokeWeight(1.5); 
          line(absGx, absGy, playerObj.x, playerObj.y); 
          fill(0, 255, 100, 220); 
          noStroke(); 
          ellipse(playerObj.x, playerObj.y, 6, 6); 
        } 
      } 
    }
    pop();

    // Główny korpus i orbity Bossa
    push();
    translate(this.x, this.y);

    // --- WIZUALIZACJA ZIELONEGO PIORUNA ---
    if (this.lightningTimer > 0) {
      push();
      // Ponieważ jesteśmy wewnątrz translate(), musimy przeliczyć pozycję gracza na relatywną względem Bossa!
      let relX = this.zapTarget.x - this.x;
      let relY = this.zapTarget.y - this.y;

      // 1. Zewnętrzna, gruba poświata neonowa
      stroke(0, 255, 100, 60 + random(0, 40));
      strokeWeight(14);
      line(0, 0, relX, relY);

      stroke(0, 255, 140, 140);
      strokeWeight(6);
      line(0, 0, relX, relY);

      // 2. Rdzeń pioruna (zygzak generowany z losowych segmentów)
      stroke(255, 255, 255, 240);
      strokeWeight(2.5);
      noFill();
      beginShape();
      vertex(0, 0);
      let steps = 5;
      for (let s = 1; s < steps; s++) {
        let t = s / steps;
        // Wzór matematyczny odchylający linię w bok o losowe wartości
        let segX = lerp(0, relX, t) + random(-22, 22);
        let segY = lerp(0, relY, t) + random(-22, 22);
        vertex(segX, segY);
      }
      vertex(relX, relY);
      endShape();
      pop();
    }

    // Wizualizacja ładowania szarży (Wariant 2: Implodujący Wir Energii)
    if (this.state === 'chase_charge') {
      push(); // Główne zabezpieczenie warstwy
      let ringsCount = 4;
      let speed = 6; 
      let maxDiameter = this.radius * 4.5; // Skąd wir zaczyna zasysać
      let minDiameter = this.radius * 1.3; // Gdzie pierścień znika (tuż przy pancerzu)

      for (let i = 0; i < ringsCount; i++) {
        let progress = ((frameCount * speed + i * (240 / ringsCount)) % 240) / 240;
        let currentDiameter = lerp(maxDiameter, minDiameter, progress);
        
        // Funkcja sinus sprawia, że okrąg płynnie rozjaśnia się po pojawieniu i miękko gaśnie przy bossie
        let alpha = lerp(0, 255, sin(progress * PI));

        push();
        rotate(frameCount * 0.02 * (i % 2 === 0 ? 1 : -1)); // Co drugi kręci się w przeciwną stronę
        stroke(255, 20, 50, alpha);
        strokeWeight(5 * (1 - progress) + 1); // Pierścienie chudną w miarę zapadania się
        noFill();
        drawingContext.setLineDash([40, 20, 10, 20]);
        ellipse(0, 0, currentDiameter);
        pop();
      }
      pop();
    }

    if (this.shieldHp > 0) {
        fill(20, 30, 50);
        stroke(this.getColorForHealth(this.shieldHp)); 
        strokeWeight(20);
        beginShape(); 
        for(let a = 0; a < TWO_PI; a += PI/3) {
          vertex(cos(a) * (this.radius * 0.7), sin(a) * (this.radius * 0.7)); 
        }
        endShape(CLOSE);
    }

    

    // Rysowanie 4 pancerzy łukowych
    for(let i = 0; i < 4; i++) { 
      if (this.armorHp[i] <= 0) continue; 
      
      let armorAngle = i * HALF_PI + this.shieldOrbit;
      
      push(); 
      rotate(armorAngle); 
      stroke(0, 100, 255); 
      strokeWeight(15); 
      fill(30, 45, 70); 
      
      beginShape(); 
      for(let a = -0.4; a <= 0.41; a += 0.1) {
        vertex(cos(a) * (this.radius * 1.15), sin(a) * (this.radius * 1.15)); 
      }
      for(let a = 0; a < 0.41; a += 0.1) { // poprawione bezpieczne domykanie pętli
         let invA = 0.4 - a;
         vertex(cos(invA) * (this.radius * 0.85), sin(invA) * (this.radius * 0.85));
      }
      endShape(CLOSE); 
      
      push(); 
      noFill(); 
      stroke(this.getColorForHealth(this.armorHp[i])); 
      strokeWeight(7.5); 
      
      beginShape(); 
      for(let a = -0.4; a <= 0.41; a += 0.05) {
        vertex(cos(a) * (this.radius * 1.15 + 12), sin(a) * (this.radius * 1.15 + 12)); 
      }
      endShape(); 
      pop(); 
      pop(); 
    }

    // Rysowanie 8 dział (zarówno na bliskiej, jak i dalekiej orbicie)
    for(let i = 0; i < 8; i++) { 
      if (this.gearHp[i] <= 0) continue; 
      
      let gearAngle = (i < 4) ? (i * HALF_PI + QUARTER_PI + this.shieldOrbit) : ((i - 4) * HALF_PI + this.shieldOrbit);
      let distFromCenter = (i < 4) ? this.radius : (this.radius * 1.5);
      
      let gx = cos(gearAngle) * distFromCenter;
      let gy = sin(gearAngle) * distFromCenter;
      
      push(); 
      translate(gx, gy); 
      
      push(); 
      noFill(); 
      let ffColor = this.getColorForHealth(this.gearHp[i]); 
      let rF = red(ffColor);
      let gF = green(ffColor);
      let bF = blue(ffColor);
      stroke(rF, gF, bF, 160 + sin(frameCount * 0.2) * 50); 
      strokeWeight(2.5); 
      
      beginShape(); 
      for (let a = 0; a < TWO_PI; a += 0.1) {
        let rWave = sin(a * 7 - frameCount * 0.15) * 4;
        vertex((60 + rWave) * cos(a), (60 + rWave) * sin(a)); 
      }
      endShape(CLOSE); 
      pop(); 
      
      push(); 
      rotate(frameCount * 0.05 + i * HALF_PI); 
      stroke(0, 90, 220); 
      strokeWeight(3.5); 
      fill(20, 50, 105); 
      
      beginShape(); 
      let teethCount = 8;
      for(let a = 0; a < TWO_PI; a += TWO_PI / (teethCount * 2)) {
        let isOuter = (floor(a / (TWO_PI / (teethCount * 2))) % 2 === 0);
        let rTooth = isOuter ? 28 : 19;
        vertex(cos(a) * rTooth, sin(a) * rTooth); 
      }
      endShape(CLOSE); 
      
      stroke(0, 160, 255); 
      strokeWeight(2); 
      fill(10, 25, 60); 
      ellipse(0, 0, 14, 14); 
      pop(); 
      
      let absGx = this.x + gx;
      let absGy = this.y + gy;
      let cannonAngle = 0;
      if (playerObj) {
        cannonAngle = atan2(playerObj.y - absGy, playerObj.x - absGx);
      }
      
      push(); 
      rotate(cannonAngle); 
      stroke(0, 120, 255); 
      strokeWeight(2.5); 
      fill(15, 35, 75); 
      rect(0, -6, 50, 12, 3); 
      noStroke(); 
      fill(0, 240, 255); 
      rect(15, -3, 32, 6, 1); 
      stroke(0, 200, 255); 
      strokeWeight(2); 
      line(26, -6, 26, 6); 
      line(38, -6, 38, 6); 
      stroke(0, 100, 230); 
      strokeWeight(2); 
      fill(28, 65, 125); 
      ellipse(0, 0, 18, 18); 
      pop(); 
      
      pop(); 
    }
    pop();

    // Rysowanie cząsteczek
    push(); 
    for (let p of this.sparkParticles) { 
      fill(255, 200, 50, p.life); 
      noStroke(); 
      ellipse(p.x, p.y, 4, 4); 
    } 
  }

  // Funkcje Wybuchu:
  //funkcja wybuchu 1/4
  startExplosion() {
    this.state = 'explosion';
    this.explosionFrame = 170; // 170 klatek, czyli prawie 3 sekundy widowiska
    this.createExplosion();
    this.exploded = true;
    
    // Zapożyczone od Matriarki: odpalenie systemowego dźwięku wybuchu
    if (typeof playEnemyExplosion === 'function') {
      playEnemyExplosion();
    }
  }

  //funkcja wybuchu 2/4
  createExplosion() {
    for (let i = 0; i < 400; i++) {
      let angle = random(TWO_PI);
      let speed = random(0, 15); // Zwiększona prędkość dla większego rozrzutu po ekranie
      let isCore = random() > 0.5; // Losowanie barwy
      
      this.explosionParticles.push({
        x: 0, 
        y: 0,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: random(1.5, 4.0), 
        life: 255,
        // Przechowujemy surowe wartości kolorów (cyjan Bossa 2 lub pomarańcz jego rdzenia)
        r: isCore ? 255 : 0,
        g: isCore ? 120 : 255,
        b: isCore ? 0 : 220
      });
    }
  }

  //funkcja wybuchu 3/4
  updateExplosion() {
    this.explosionFrame--; 
    for (let p of this.explosionParticles) {
      p.x += p.vx; 
      p.y += p.vy;
      p.life -= 1.5; 
    }
  }

  //funkcja wybuchu 4/4
  drawExplosion() {
    for (let p of this.explosionParticles) {
      if (p.life <= 0) continue;
      stroke(p.r, p.g, p.b, p.life); 
      strokeWeight(p.size); 
      point(p.x, p.y);
    }
  }

}