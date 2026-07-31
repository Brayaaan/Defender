// ---------------------------------------------------------------------------
// Vertex shader dla Oka
// ---------------------------------------------------------------------------
const ENEMY3_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

// ---------------------------------------------------------------------------
// Fragment shader dla Oka (Organiczna tkanka, pulsujące żyły, anihilacja)
// ---------------------------------------------------------------------------
const ENEMY3_FRAG_SRC = `precision highp float;
varying vec2 vTexCoord;

uniform float uTime;
uniform float uExplosion; 
uniform float uChasing;   
uniform float uBerserk;   
uniform float uAngle;     
uniform float uPupilSize; // Znormalizowany rozmiar (0.0 do 1.0)

// Funkcje szumu
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
  return f;
}

void main() {
  vec2 uv = (vTexCoord - 0.5) * 2.0;
  float d = length(uv);
  vec4 finalColor = vec4(0.0);

  // --- 1. TWARDÓWKA (Białko oka) ---
  float scleraMask = 1.0 - smoothstep(0.8, 0.85, d);
  
  vec3 colNormal = vec3(1.0, 0.92, 0.86);
  vec3 colChase = vec3(1.0, 0.4, 0.4);
  vec3 baseCol = mix(colNormal, colChase, uChasing);

  // --- 2. KRWAWA SIEĆ (Pulsujące naczynka) ---
  float angle = atan(uv.y, uv.x);
  float veinPulse = sin(uTime * 5.0) * 0.5 + 0.5;
  float vNoise = fbm(vec2(angle * 8.0, d * 10.0 - uTime * 2.0));
  float veins = smoothstep(0.5, 0.7, vNoise) * smoothstep(0.1, 0.9, d);
  vec3 veinCol = vec3(0.8, 0.0, 0.0) * (0.6 + 0.4 * veinPulse);
  baseCol = mix(baseCol, veinCol, veins * 0.8);

  // --- 3. TĘCZÓWKA I ŹRENICA ---
  vec2 lookOffset = vec2(cos(uAngle), sin(uAngle)) * 0.25;
  vec2 uvEye = uv - lookOffset;
  float dEye = length(uvEye);

  float irisRadius = mix(0.35, 0.5, uPupilSize); 
  float irisMask = 1.0 - smoothstep(irisRadius - 0.02, irisRadius + 0.02, dEye);
  
  float pupilRadius = irisRadius * 0.45;
  float pupilMask = 1.0 - smoothstep(pupilRadius - 0.02, pupilRadius + 0.02, dEye);

  vec3 irisColNormal = vec3(0.0, 1.0, 0.8); // Cyan
  vec3 irisColBerserk = vec3(1.0, 0.23, 0.0); // Pomarańczowy
  vec3 currentIris = mix(irisColNormal, irisColBerserk, uBerserk);

  // Tekstura tęczówki
  float irisTex = fbm(uvEye * 20.0 + uTime);
  currentIris *= (0.5 + 0.5 * irisTex);

  // Złożenie oka w całość
  vec3 eyeDetails = mix(baseCol, currentIris, irisMask);
  eyeDetails = mix(eyeDetails, vec3(0.0), pupilMask);

  // Błysk w oku (wilgotność)
  float highlight = 1.0 - smoothstep(0.03, 0.06, length(uvEye - vec2(-0.1, -0.1)));
  eyeDetails = mix(eyeDetails, vec3(1.0), highlight * irisMask);

  // Ciemna opuchnięta obwódka
  float rimMask = smoothstep(0.7, 0.85, d);
  eyeDetails = mix(eyeDetails, vec3(0.4, 0.0, 0.0), rimMask * 0.7);

  // --- 4. WYBUCH ---
  if (uExplosion > 0.0) {
    float dissolveNoise = fbm(uv * 10.0 - uTime * 3.0);
    float dissolveFactor = smoothstep(uExplosion - 0.2, uExplosion + 0.1, dissolveNoise);
    vec3 explCol = vec3(1.0, 0.0, 0.1); 
    
    vec3 finalDissolve = mix(explCol, eyeDetails, dissolveFactor);
    float alpha = scleraMask * dissolveFactor;
    // FIX: Mnożenie koloru przez kanał alpha usuwa artefakty tła
    finalColor = vec4(finalDissolve * alpha, alpha);
  } else {
    // FIX: Mnożenie koloru przez kanał alpha
    finalColor = vec4(eyeDetails * scleraMask, scleraMask);
  }

  gl_FragColor = finalColor;
}`;




class Enemy3_czerwone_kulki {
  constructor() {
    this.x = width;
    this.y = random(20, height - 20);
    this.vx = random(-5, -2.3);
    this.vy = random(-1.5, 1.5);
    
    this.radius = 18; 
    this.health = 25;
    this.points = 250;
    this.explosionFrame = 0;
    this.explosionParticles = [];
    this.exploded = false;
    
    this.shootTimer = floor(random(0, 120)); 
    this.shootInterval = 120; 
    this.lastCollisionFrame = -Infinity;
    
    // LOGIKA POŚCIGU (0.01)
    this.originalVx = this.vx; 
    this.originalVy = this.vy; 
    this.chaseTimer = floor(random(0, 300)); 
    this.isChasing = false; 
    this.chaseDuration = 0;
    this.chaseSpeed = 0.01; 

    // Porwanie, zmiana 1/6 Referencja do porwanego astronauty
    this.victim = null;

    // Mechanika wampira energetycznego (Impuls)
    this.vampireCooldown = 0;    
    this.vampireBeamTimer = 0;   

    this.pupilSize = 6;
    this.irisColor = [0, 255, 200]; 

    // Licznik przelotów i szał
    this.screenCrossCount = 0;   
    this.isBerserk = false;

  }

  startExplosion() {
    this.victim = null; // Porwanie, zmiana 2/6 Natychmiastowe zerwanie nici przy wybuchu
    this.vampireBeamTimer = 0; 
    this.explosionFrame = 60;   // <--- CZAS TRWANIA eksplozji (w klatkach)
    this.explosionParticles = [];

    // Warstwa 1: Smużyste Odłamki (Linie Plasma) - 20 sztuk (Neonowa Czerwień)
    for (let i = 0; i < 20; i++) {
      this.explosionParticles.push({
        type: 1,
        x: this.x, y: this.y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random(1, 3)
      });
    }

    // Warstwa 2: Deszcz iskier - 25 sztuk (Żywa, krwista czerwień)
    for (let i = 0; i < 25; i++) {
      this.explosionParticles.push({
        type: 2,
        x: this.x, y: this.y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random([1, 2, 4])
      });
    }

    // Warstwa 3: Odłamki pancerza/twardówki z grawitacją - 15 sztuk (Głębokie bordo)
    for (let i = 0; i < 15; i++) {
      this.explosionParticles.push({
        type: 3,
        x: this.x, y: this.y,
        vx: random(-3, 3), vy: random(-3, 3),
        w: random(4, 7), h: random(2, 4)
      });
    }
  }

  update(bulletsArray) {

    // po wybuchu wroga aplikuje siłę grawitacji wyłącznie do najcięższych odłamków (typ 3)
    if (this.explosionFrame > 0) {

      // NOWE: Oko nadal leci w trakcie cyfrowego rozpadu
      this.x += this.vx;
      this.y += this.vy;

      for (let p of this.explosionParticles) { 
        p.x += p.vx; 
        p.y += p.vy; 
        
        // Grawitacja ściągająca w dół mięsiste odłamki rozerwanej gałki (typ 3)
        if (p.type === 3) {
          p.vy += 0.05;
        }
      }
      this.explosionFrame--;
      return;
    }
    
    // --- LOGIKA WAMPIRA (Strzał 5%) ---
    if (this.vampireCooldown > 0) this.vampireCooldown--;
    if (this.vampireBeamTimer > 0) this.vampireBeamTimer--;

    let dToPlayer = dist(this.x, this.y, player.x, player.y);
    if (dToPlayer < 150 && this.vampireCooldown <= 0 && !this.exploded) {
      player.takeDamage(5); 
      this.vampireCooldown = 180; // 3s
      this.vampireBeamTimer = 30; // 1s trwania nici
    }

    // --- LOGIKA POŚCIGU (Zmodernizowana) ---
    if (this.isChasing) {
      this.chaseDuration++;
      if (this.chaseDuration >= 180) { 
        this.isChasing = false;
        this.vx = this.originalVx; this.vy = this.originalVy; 
      } else {
        if (typeof playSoundPogon === 'function') playSoundPogon();
        this.vx = (player.x - this.x) * this.chaseSpeed;
        this.vy = (player.y - this.y) * this.chaseSpeed;
      }
      this.pupilSize = lerp(this.pupilSize, 12, 0.1); 
    } else {
      this.chaseTimer--;
      if (this.chaseTimer <= 0) {
        if (this.isBerserk) {
          // TRYB BERSERK: 100% szansy na pościg co 3 sekundy (180 klatek przy 60 FPS)
          this.isChasing = true;
          this.chaseDuration = 0; 
          this.chaseTimer = 180; 
        } else {
          // TRYB NORMALNY (Stary)
          if (random(1) < 0.33) {
            this.isChasing = true;
            this.chaseDuration = 0; // <--- Tu krył się stary bug, teraz zresetowane!
          }
          this.chaseTimer = 300; 
        }
      }
      this.pupilSize = lerp(this.pupilSize, 6, 0.05); 
    }

    this.x += this.vx;
    this.y += this.vy;

    // Porwanie, zmiana 3/6
    if (this.x < 20) this.victim = null; 

    // Odbijanie i zliczanie przelotów przez ekran
    if (!this.isChasing) {
      if (this.x < 0) {
        this.x = width;
        this.y = random(20, height - 20);
        
        // NOWE: Rejestrujemy udaną ucieczkę oka za lewą krawędź
        this.screenCrossCount++;
        if (this.screenCrossCount >= 6 && !this.isBerserk) {
          this.isBerserk = true;
          this.chaseTimer = 120;          // Odliczaj równe 2 sekundy do pierwszego ataku, 120 klatek
          this.irisColor = [255, 60, 0];  // Wizualna zmiana: ostrzegawczy pomarańcz!
        }
      }
      if (this.y <= 20 || this.y >= height - 20) this.vy *= -1;
    }
    
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shoot(bulletsArray);
      this.shootTimer = this.shootInterval; 
    }
  }

  shoot(bulletsArray) {
    if (bulletsArray) bulletsArray.push(new EnemyBullet(this.x, this.y)); 
  }

  show(pg) {
    // Wsparcie dla globalnej warstwy WebGL
    if (!pg && typeof gpuLayer !== 'undefined') {
      pg = gpuLayer;
    }

    // --- 1. RYSOWANIE W 2D (Ogon, Promienie, Cząsteczki Wybuchu) ---
    let explRatio = 0.0;
    if (this.explosionFrame > 0) {
      explRatio = 1.0 - (this.explosionFrame / 60.0);
      let alpha = map(this.explosionFrame, 0, 60, 0, 255);

      push();
      blendMode(ADD);
      stroke(255, 0, 80, alpha); 
      for (let p of this.explosionParticles) {
        if (p.type === 1) {
          strokeWeight(p.size);
          line(p.x, p.y, p.x - p.vx * 1.5, p.y - p.vy * 1.5);
        }
      }
      pop();

      push();
      noStroke();
      for (let p of this.explosionParticles) {
        if (p.type === 2) {
          fill(255, 20, 20, alpha);
          rect(p.x, p.y, p.size, p.size);
        } else if (p.type === 3) {
          fill(120, 5, 10, alpha);
          rect(p.x, p.y, p.w, p.h);
        }
      }
      pop();
    }

    // Rysowanie nici porwania (Żółta)
    if (this.victim && !this.exploded) {
      let steps = 6;
      let lastX = this.x;
      let lastY = this.y;
      
      for (let i = 1; i <= steps; i++) {
        let t = i / steps;
        let targetX = lerp(this.x, this.victim.x, t);
        let targetY = lerp(this.y, this.victim.y, t);

        if (i < steps) {
          targetX += random(-4, 4);
          targetY += random(-4, 4);
        }

        stroke(255, 100, 0, 100);
        strokeWeight(4 + sin(frameCount * 0.2) * 2);
        line(lastX, lastY, targetX, targetY);

        stroke(255, 255, 0);
        strokeWeight(1.5);
        line(lastX, lastY, targetX, targetY);

        lastX = targetX;
        lastY = targetY;
      }
      noStroke();
    }

    // Rysowanie promienia wampira (Czerwona)
    if (this.vampireBeamTimer > 0 && !this.exploded) {
      let steps = 6;
      let lastX = this.x;
      let lastY = this.y;
      for (let i = 1; i <= steps; i++) {
        let t = i / steps;
        let targetX = lerp(this.x, player.x, t);
        let targetY = lerp(this.y, player.y, t);
        if (i < steps) {
          targetX += random(-6, 6); 
          targetY += random(-6, 6);
        }
        stroke(255, 50, 0, 150); 
        strokeWeight(5 + sin(frameCount * 0.5) * 3);
        line(lastX, lastY, targetX, targetY);
        stroke(255, 255, 200); 
        strokeWeight(2);
        line(lastX, lastY, targetX, targetY);
        lastX = targetX;
        lastY = targetY;
      }
      noStroke();
    }

    // Rysowanie 2D ogona za okiem
    if (this.explosionFrame === 0) {
      let angle = atan2(player.y - this.y, player.x - this.x);
      let tailLen = this.isChasing ? 180 : 60;
      push();
      translate(this.x, this.y);
      noStroke();
      for (let i = 1; i <= 10; i++) {
        let d = i * (tailLen / 10);
        let wave = sin(frameCount * 0.2 + i) * (i * 1.2); 
        let tx = cos(angle + PI) * (d + 15) + cos(angle + HALF_PI) * wave;
        let ty = sin(angle + PI) * (d + 15) + sin(angle + HALF_PI) * wave;
        fill(255, 150 - i * 15, 0, 255 - i * 20);
        let size = 8 - i * 0.5;
        ellipse(tx, ty, size, size);
      }
      pop();
    }

    // --- 2. SHADER OKA (WebGL) ---
    if (pg) {
      if (!this.constructor.shaderLoaded) {
        this.constructor.shader = pg.createShader(ENEMY3_VERT_SRC, ENEMY3_FRAG_SRC);
        this.constructor.shaderLoaded = true;
      }

      let angleToPlayer = atan2(player.y - this.y, player.x - this.x);
      // Mapowanie źrenicy z oryginalnych wartości 6-12 na 0.0-1.0 dla shadera
      let pSizeNorm = constrain(map(this.pupilSize, 6, 12, 0, 1), 0, 1);

      pg.push();
      pg.translate(this.x, this.y, 0);
      pg.noStroke();
      
      pg.shader(this.constructor.shader);
      this.constructor.shader.setUniform('uTime', millis() / 1000.0);
      this.constructor.shader.setUniform('uExplosion', explRatio);
      this.constructor.shader.setUniform('uChasing', this.isChasing ? 1.0 : 0.0);
      this.constructor.shader.setUniform('uBerserk', this.isBerserk ? 1.0 : 0.0);
      this.constructor.shader.setUniform('uAngle', angleToPlayer);
      this.constructor.shader.setUniform('uPupilSize', pSizeNorm);

      // Renderowanie płaszczyzny wystarczająco dużej, aby pomieścić ciało oka
      pg.plane(this.radius * 3.5, this.radius * 3.5);
      
      pg.resetShader();
      pg.pop();
    }
  }



  // Porwanie, zmiana 5/6 (ORGINAŁ)
  abducts(humanoid) {
    if (this.x < 20) {
      this.victim = null;
      return false;
    }
    if (rectCircleCollision(
      humanoid.x, humanoid.y, humanoid.radius * 2, humanoid.radius * 2,
      this.x, this.y, this.radius
    )) {
      this.victim = humanoid; 
      humanoid.isAbducted = true;  
      humanoid.vx = this.vx;
      humanoid.vy = this.vy;
      return false;  
    }
    return false;
  }

  hits(player) {
    return rectCircleCollision(player.x - player.width/2, player.y - player.height/2, player.width, player.height, this.x, this.y, this.radius);
  }

  hitByBullet(bullet) {
    return rectCircleCollision(bullet.x, bullet.y, bullet.width, bullet.height, this.x, this.y, this.radius);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.exploded) {
      score += this.points;
      this.startExplosion();
      this.exploded = true;
      if (typeof playEnemyExplosion === 'function') playEnemyExplosion();
      return true;
    }
    return false;
  }

  handleCollision(player) {
    if (frameCount - this.lastCollisionFrame >= 30) {
      player.takeDamage(15);
      if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
      this.x += 80;
      this.lastCollisionFrame = frameCount;
      this.victim = null; // Porwanie, zmiana 6/6
    }
  }
}

if (typeof window !== 'undefined') { window.Enemy3_czerwone_kulki = Enemy3_czerwone_kulki; }