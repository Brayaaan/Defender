class Enemy2_niebieskie_kulki {
  constructor() {
    this.x = width;
    this.y = random(0.02 * height, height - 0.02 * height);
    this.vx = random(-6, -2); // ruch w poziomie
    this.vy = random(-1.6, 1.6); // ruch w pionie
    this.radius = 35; // rozmiar trafienia wroga
    this.health = 5;
    this.points = 25; // punkty
    this.explosionFrame = 0;
    this.explosionParticles = [];
    this.exploded = false;
    this.shootTimer = floor(random(0, 120)); // Losowy offset startowy (0-119 klatek)
    this.shootInterval = 120; // Podwojony interwał do 120 klatek
    this.lastCollisionFrame = -Infinity; // Dodano do śledzenia czasu kolizji

    // Licznik przelotów
    this.passCount = 0;

    // Porwanie, zmiana 1/6 Referencja do porwanego astronauty
    this.victim = null;
  }

  startExplosion() {
    this.victim = null;              // Porwanie, zmiana 2/6 Natychmiastowe zerwanie nici przy wybuchu
    this.explosionFrame = 60;        // czas eksplozji (1 sekunda)
    this.explosionParticles = [];    // Tablica pusta - cząsteczki liczy teraz wyłącznie karta graficzna (GPU)!
  }

  update(bulletsArray) {
    // --- ZAMIANA NA SHADER: Lekka obsługa wybuchu bez pętli na CPU ---
    if (this.explosionFrame > 0) {
      this.explosionFrame--;
      return; // Przerywamy dalszą aktualizację pozycji statku i strzelania
    }

    this.x += this.vx;
    this.y += this.vy;

    //  Porwanie, zmiana 3/6  --- WARUNEK KOŃCA PORWANIA (20px przed krawędzią) ---
    if (this.x < 20) {
      this.victim = null; 
    }

    // --- ZWIĘKSZANIE LICZNIKA PRZELOTÓW I RESP ---
    if (this.x < 0) {
      this.x = width;
      this.y = random(0.02 * height, height - 0.02 * height);
      this.passCount++; // Zwiększamy licznik
      this.shootTimer = floor(random(0, 120)); // Losowy czas strzelania po zrespieniu
      this.lastCollisionFrame = -Infinity; // Reset czasu kolizji
    }
    
    // Odbicie od górnej i dolnej krawędzi
    if (this.y <= 0.02 * height || this.y >= height - 0.02 * height) { 
      this.vy = -this.vy;
    }

    // --- STRZELANIE ---
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shoot(bulletsArray);
      this.shootTimer = this.shootInterval; // Reset do stałego interwału 120 klatek
    }
  }

  shoot(bulletsArray) {
      if (typeof bulletsArray !== 'undefined') {
          if (this.passCount >= 4) {
              // STRZAŁ PROMIENISTY (10 kierunków)
              let numBullets = 10;
              for (let i = 0; i < numBullets; i++) {
                  let angle = (TWO_PI / numBullets) * i;
                  // Tworzymy nowy pocisk z prędkością rozchodzącą się promieniście
                  let b = new EnemyBullet(this.x, this.y);
                  b.vx = cos(angle) * 4; // prędkość 4
                  b.vy = sin(angle) * 4;
                  bulletsArray.push(b);
              }
          } else {
              // POJEDYNCZY STRZAŁ (stary styl)
              bulletsArray.push(new EnemyBullet(this.x, this.y));
          }
      }
  }

  show() {
    // --- NOWY SILNIK GPU: BLUE EXPLOSION ---
    if (this.explosionFrame > 0) {
      if (typeof window.blueExplosionGfx === 'undefined') {
        window.blueExplosionGfx = createGraphics(256, 256, WEBGL);
        window.blueExplosionGfx.noStroke();
        
        const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
        
        const frag = `precision mediump float;
        varying vec2 vUv;
        uniform float uProgress; 

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float dLine(vec2 p, vec2 a, vec2 b) {
            vec2 pa = p - a, ba = b - a;
            float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            return length(pa - ba * h);
        }

        void main() {
            vec2 pos = (vUv - 0.5) * 512.0;
            float T = uProgress * 60.0;
            float alphaFade = 1.0 - uProgress;

            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            // WARSTWA 3: Ciężki pancerz wroga z grawitacją (8 sztuk)
            for(int i = 50; i < 58; i++) {
                float seed = float(i);
                vec2 v = vec2(hash(vec2(seed, 3.1)), hash(vec2(seed, 3.2))) * 8.0 - 4.0;
                
                // Grawitacja o wektorze w dół
                float drop = -0.05 * (T * T) / 2.0; 
                vec2 pCenter = vec2(v.x * T, -(v.y * T) + drop); 

                float w = hash(vec2(seed, 3.3)) * 3.0 + 4.0; 
                float h = hash(vec2(seed, 3.4)) * 2.0 + 2.0; 

                vec2 d = abs(pos - pCenter);
                if(d.x < w/2.0 && d.y < h/2.0) {
                    finalColor = vec3(1.0, 0.39, 0.0); // Ognisty pomarańcz
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }

            // WARSTWA 2: Cyjanowy deszcz iskier (16 sztuk)
            for(int i = 30; i < 46; i++) {
                float seed = float(i);
                vec2 v = vec2(hash(vec2(seed, 2.1)), hash(vec2(seed, 2.2))) * 8.0 - 4.0;
                vec2 pCenter = vec2(v.x * T, -(v.y * T));

                float rnd = hash(vec2(seed, 2.3));
                float size = rnd < 0.33 ? 1.0 : (rnd < 0.66 ? 2.0 : 4.0);

                vec2 d = abs(pos - pCenter);
                if(d.x < size/2.0 && d.y < size/2.0) {
                    finalColor = vec3(0.39, 0.78, 1.0); // Cyjan
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }

            // WARSTWA 1: Smużyste Odłamki energii (Linie Plasma) (12 sztuk)
            for(int i = 0; i < 12; i++) {
                float seed = float(i);
                vec2 v = vec2(hash(vec2(seed, 1.1)), hash(vec2(seed, 1.2))) * 8.0 - 4.0;
                vec2 pCenter = vec2(v.x * T, -(v.y * T));
                
                vec2 a = pCenter;
                vec2 b = pCenter - vec2(v.x * 1.5, -(v.y * 1.5));
                float dist = dLine(pos, a, b);

                float size = hash(vec2(seed, 1.3)) * 2.0 + 1.0; 

                if(dist < size / 2.0) {
                    finalColor += vec3(1.0, 0.78, 0.39); // Żółto-pomarańczowy blask
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }
            
            gl_FragColor = vec4(finalColor, finalAlpha * alphaFade);
        }`;
        
        window.blueExplosionShader = window.blueExplosionGfx.createShader(vert, frag);
      }

      window.blueExplosionGfx.clear();

      // Odliczanie czasu eksplozji
      let progress = (60.0 - this.explosionFrame) / 60.0;
      window.blueExplosionShader.setUniform('uProgress', progress);
      
      window.blueExplosionGfx.shader(window.blueExplosionShader);
      window.blueExplosionGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);

      push();
      imageMode(CENTER);
      image(window.blueExplosionGfx, this.x, this.y, 256, 256); 
      pop();

      return; // Przerywa rysowanie podstawowego wroga na czas eksplozji
    }
    // --- KONIEC SILNIKA GPU EKSPLOZJA ---

    // Porwanie, zmiana 4/6 --- RYSOWANIE ŻÓŁTEJ NICI ---
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

    // --- NOWY SILNIK GPU: ZOPTYMALIZOWANY ORBITALNY STRAŻNIK (BEZ UWARN) ---
    if (typeof window.blueGfx === 'undefined') {
      window.blueGfx = createGraphics(80, 80, WEBGL);
      window.blueGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float; 
varying vec2 vUv; 
uniform float uTime;

float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773502);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float t = uTime;
  
  float dHex = sdHex(uv, 0.45);
  float hexFill = smoothstep(0.02, -0.02, dHex);
  float hexEdge = smoothstep(0.04, 0.0, abs(dHex + 0.02)); 
  
  float dEye = length(uv) - 0.15;
  float eyeFill = smoothstep(0.02, -0.02, dEye);
  float eyeHigh = smoothstep(0.02, -0.02, length(uv - vec2(-0.05, 0.05)) - 0.03);
  
  // Usunięto uWarn - ujednolicony wygląd dla optymalizacji bufora
  vec3 eyeColBase = vec3(0.0, 0.8, 1.0);
  float eyePulse = sin(t * 5.0) * 0.2 + 0.8;
  vec3 eyeCol = eyeColBase * eyePulse * eyeFill + vec3(1.0) * eyeHigh;
  
  float angle = atan(uv.y, uv.x) + t * 1.5;
  float r = length(uv);
  
  float shieldRing = smoothstep(0.03, 0.0, abs(r - 0.75) - 0.1);
  float sector = mod(angle, 2.09439) - 1.04719; 
  float arcMask = smoothstep(0.05, 0.0, abs(sector) - 0.6);
  float shields = shieldRing * arcMask;
  
  float shieldEdge = smoothstep(0.02, 0.0, abs(abs(r - 0.75) - 0.1)) * arcMask + 
                     smoothstep(0.02, 0.0, abs(abs(sector) - 0.6)) * shieldRing;
  shieldEdge = clamp(shieldEdge, 0.0, 1.0);
  
  float dots = smoothstep(0.02, 0.0, abs(r - 0.8)) * smoothstep(0.02, 0.0, abs(abs(sector) - 0.45));
  
  vec3 darkBlue = vec3(0.05, 0.15, 0.35); 
  vec3 lightBlue = vec3(0.0, 0.4, 1.0);   
  
  vec3 rgb = vec3(0.0);
  float alpha = 0.0;
  
  if (shields > 0.0) {
      rgb = mix(rgb, darkBlue, shields);
      rgb = mix(rgb, lightBlue, shieldEdge);
      rgb = mix(rgb, vec3(0.0, 0.8, 1.0), dots);
      alpha = max(alpha, shields);
  }
  if (hexFill > 0.0 || hexEdge > 0.0) {
      rgb = mix(rgb, darkBlue, hexFill);
      rgb = mix(rgb, lightBlue, hexEdge);
      alpha = max(alpha, max(hexFill, hexEdge));
  }
  if (eyeFill > 0.0) {
      rgb = mix(rgb, eyeCol, eyeFill);
      alpha = max(alpha, eyeFill);
  }
  
  float aura = smoothstep(1.0, 0.4, r) * 0.25;
  vec3 auraColor = vec3(0.0, 0.3, 0.8);
  rgb += auraColor * aura;
  alpha = max(alpha, aura);
  
  gl_FragColor = vec4(rgb, alpha);
}`;
      
      window.blueShader = window.blueGfx.createShader(vert, frag);
      window.lastBlueUpdateFrame = -1;
    }
    
    // Optymalizacja: stemplowanie grafiki bez ponownego liczenia niezależnego uWarn
    if (window.lastBlueUpdateFrame !== frameCount) {
      window.blueGfx.clear();
      window.blueShader.setUniform('uTime', millis() / 1000.0);
      
      window.blueGfx.shader(window.blueShader);
      window.blueGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
      
      window.lastBlueUpdateFrame = frameCount;
    }
    
    push();
    imageMode(CENTER);
    image(window.blueGfx, this.x, this.y);
    pop();
    // --- KONIEC SILNIKA GPU ---
  }

  //  Porwanie, zmiana 5/6
  abducts(humanoid) {
    // Jeśli wróg jest zbyt blisko lewej krawędzi, nie może porywać/trzymać
    if (this.x < 20) {
      this.victim = null;
      return false;
    }

    if (rectCircleCollision(
      humanoid.x, humanoid.y, humanoid.radius * 2, humanoid.radius * 2,
      this.x, this.y, this.radius
    )) {
      this.victim = humanoid; // Zapamiętujemy ofiarę do rysowania nici
      humanoid.isAbducted = true; 
      humanoid.vx = this.vx;
      humanoid.vy = this.vy;
      return false; 
    }
    return false;
  }    // koniec 5/6 abducts(humanoid)

  hits(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }

  hitByBullet(bullet) {
    return rectCircleCollision(
      bullet.x, bullet.y, bullet.width, bullet.height,
      this.x, this.y, this.radius
    );
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.exploded) {
      score += this.points; // DODANO: Aktualizacja wyniku gry
      this.startExplosion();
      this.exploded = true;
      playEnemyExplosion().catch(error => console.error("Błąd wybuchu wroga:", error));
      return true; // Zwraca true, gdy wróg został zniszczony
    }
    return false; // Zwraca false, jeśli wróg jeszcze żyje
  }

  // Metoda obsługująca kolizję z rakietą
  handleCollision(player) {
    if (frameCount - this.lastCollisionFrame >= 30) { // Opóźnienie 30 klatek między kolizjami
      player.takeDamage(15); // Odejmij 15% tarczy
      playSoundKolizjaRakiety();
      if (player.shieldPower <= 0) {
        player.startExplosion();
      }
      // Odbicie o wektor 80 pikseli w prawo z losowym offsetem pionowym ±40
      let verticalOffset = random(-40, 40);
      this.x += 80;
      this.y += verticalOffset;
      this.lastCollisionFrame = frameCount; // Aktualizacja czasu kolizji

      this.victim = null; // Porwanie, zmiana 6/6  Kolizja z graczem zrywa nić
    }
  }
}

// Klasa pocisku wroga
class EnemyBullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = -3; // Prędkość strzału
    this.vy = 0;
    this.width = 9; // wielkość pocisku
    this.height = 3; // wielkość pocisku
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  show() {
    if (this.exploded) return;

    // --- NOWY SILNIK GPU: LASER ---
    if (typeof window.laserGfx === 'undefined') {
      // Tworzymy bufor graficzny dla strzału (z zapasem na poświatę)
      window.laserGfx = createGraphics(50, 50, WEBGL);
      window.laserGfx.noStroke();
      
      const vert = `precision mediump float; 
attribute vec3 aPosition; 
attribute vec2 aTexCoord; 
varying vec2 vUv; 
void main() { 
  vUv = aTexCoord; 
  gl_Position = vec4(aPosition, 1.0); 
}`;
      
      const frag = `precision mediump float; 
varying vec2 vUv; 
uniform float uTime;

void main() {
  // Przekształcenie UV na zakres od -1.0 do 1.0
  vec2 uv = (vUv - 0.5) * 5.5;
  
  // Obliczanie dystansu od osi X i Y
  float distY = abs(uv.y);
  float distX = abs(uv.x);

  // Generowanie poświaty (Glow) bazującej na odległości od środka w osi Y
  // Zwiększony licznik daje mocniejsze świecenie
  float glow = 0.05 / (distY + 0.02); 
  
  // Wygładzenie i przycięcie wiązki na końcach (wzdłuż osi X)
  // Wartości 0.8 i 0.4 tworzą miękki, zanikający ogon
  float edgeX = smoothstep(0.8, 0.5, distX);
  
  // Definicja kolorów
  vec3 coreColor = vec3(1.0, 0.5, 1.0); //  rdzeń
  vec3 glowColor = vec3(0.0, 0.8, 2.0); //  aura
  
  // Mieszanie kolorów: rdzeń w centrum, aura na zewnątrz
  vec3 col = mix(glowColor, coreColor, smoothstep(0.15, 0.0, distY));
  
  // Aplikowanie intensywności poświaty i przycięcia krawędzi
  col *= glow * edgeX;
  
  // Pulsowanie światła w czasie
  float pulse = sin(uTime * 1.0) * 0.15 + 0.85;
  col *= pulse;
  
  // Obliczanie przezroczystości bazującej na jasności koloru
  float alpha = max(col.r, max(col.g, col.b));
  
  gl_FragColor = vec4(col, alpha);
}`;
      
      window.laserShader = window.laserGfx.createShader(vert, frag);
      // Dodajemy zmienną do śledzenia ostatnio odświeżonej klatki dla wroga
      window.lastEnemyLaserUpdateFrame = -1;
    }
    
    // Odświeżamy bufor shadera TYLKO RAZ w danej klatce animacji
    if (window.lastEnemyLaserUpdateFrame !== frameCount) {
      window.laserGfx.clear();
      window.laserShader.setUniform('uTime', millis() / 1000.0);
      window.laserGfx.shader(window.laserShader);
      window.laserGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
      
      // Zapisujemy, że w tej klatce bufor został już zaktualizowany
      window.lastEnemyLaserUpdateFrame = frameCount;
    }
    
    // Rysowanie wyrenderowanego strzału
    push();
    translate(this.x, this.y);
    rotate(this.angle); // Obrót zgadza się z wektorem lotu
    imageMode(CENTER);
    
    // Dodatkowy tryb mieszania wzmacniający świetlistość
    blendMode(ADD); 
    image(window.laserGfx, 0, 0);
    pop();
    // --- KONIEC SILNIKA GPU ---
  }


  hits(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.width / 2
    );
  }
}

// Eksport dla kompatybilności
if (typeof window !== 'undefined') {
  window.Enemy2_niebieskie_kulki = Enemy2_niebieskie_kulki;
  window.EnemyBullet = EnemyBullet;
}