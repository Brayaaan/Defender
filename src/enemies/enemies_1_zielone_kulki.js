// Broń 1 dla wroga zielone kulki
class LaserWroga {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 7;
    this.radius = 20;   // rozmiar trafienia wroga
    this.exploded = false;
  }

  hits(target) {
    return false; // Zwracamy false, bo kolizję liczymy już w update()
  }

  update() {
    this.x += cos(this.angle) * this.speed;
    this.y += sin(this.angle) * this.speed;

    // Sprawdzenie kolizji z graczem (zakładając, że obiekt player jest dostępny globalnie)
    if (!this.exploded && typeof player !== 'undefined' && player.isActive()) {
      let d = dist(this.x, this.y, player.x, player.y);
      if (d < player.width / 2 + this.radius) {
        player.takeDamage(5); // 5% obrażeń
        this.exploded = true;

      }
    }
  }

  show() {
    if (this.exploded) return;

    // --- NOWY SILNIK GPU: LASER ---
    if (typeof window.GreenlaserGfx === 'undefined') {
      // Tworzymy bufor graficzny dla strzału (z zapasem na poświatę)
      window.GreenlaserGfx = createGraphics(60, 60, WEBGL);
      window.GreenlaserGfx.noStroke();
      
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
  vec2 uv = (vUv - 0.5) * 2.0;
  
  // Obliczanie dystansu od osi X i Y
  float distY = abs(uv.y);
  float distX = abs(uv.x);

  // Generowanie poświaty (Glow) bazującej na odległości od środka w osi Y
  // Zwiększony licznik daje mocniejsze świecenie
  float glow = 0.05 / (distY + 0.02); 
  
  // Wygładzenie i przycięcie wiązki na końcach (wzdłuż osi X)
  // Wartości 0.8 i 0.4 tworzą miękki, zanikający ogon
  float edgeX = smoothstep(0.9, 0.4, distX);
  
  // Definicja kolorów
  vec3 coreColor = vec3(1.0, 1.0, 0.8); // Jasny, biało-żółty rdzeń
  vec3 glowColor = vec3(1.0, 0.8, 0.0); // Nasycona, żółta aura
  
  // Mieszanie kolorów: rdzeń w centrum, aura na zewnątrz
  vec3 col = mix(glowColor, coreColor, smoothstep(0.15, 0.0, distY));
  
  // Aplikowanie intensywności poświaty i przycięcia krawędzi
  col *= glow * edgeX;
  
  // Pulsowanie światła w czasie
  float pulse = sin(uTime * 25.0) * 0.15 + 0.85;
  col *= pulse;
  
  // Obliczanie przezroczystości bazującej na jasności koloru
  float alpha = max(col.r, max(col.g, col.b));
  
  gl_FragColor = vec4(col, alpha);
}`;
      
      window.laserShader = window.GreenlaserGfx.createShader(vert, frag);
      // Dodajemy zmienną do śledzenia ostatnio odświeżonej klatki dla wroga
      window.lastEnemyLaserUpdateFrame = -1;
    }
    
    // Odświeżamy bufor shadera TYLKO RAZ w danej klatce animacji
    if (window.lastEnemyLaserUpdateFrame !== frameCount) {
      window.GreenlaserGfx.clear();
      window.laserShader.setUniform('uTime', millis() / 1000.0);
      window.GreenlaserGfx.shader(window.laserShader);
      window.GreenlaserGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
      
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
    image(window.GreenlaserGfx, 0, 0);
    pop();
    // --- KONIEC SILNIKA GPU ---
  }

  isOffScreen() {
    return (this.x < -50 || this.x > width + 50 || this.y < -50 || this.y > height + 50);
  }
}



class Enemy1_zielone_kulki {
  constructor() {
    this.x = width; // Start z prawej strony
    this.y = random(0.02 * height, height - 0.02 * height);
    this.vx = random(-6, -2); // Losowa prędkość w lewo
    this.vy = random(-1.6, 1.6); // Losowa prędkość pionowa
    this.radius = 9; //rozmiar wrogów
    this.health = 1; // Zdrowie wroga
    this.points = 10; // Dodano - Punkty za zniszczenie wroga
    this.explosionFrame = 0;
    this.explosionParticles = [];
    this.exploded = false;
    this.lastCollisionFrame = -Infinity; // Dodano do śledzenia czasu kolizji

    // Porwanie, zmiana 1/6 Referencja do porwanego astronauty
    this.victim = null;

    this.pulse = random(TWO_PI); // Zmienna do pulsowania ciała i szczypiec kleszcza
    this.jitter = random(1000);  // Unikalne przesunięcie falowania kleszcza

    // strzały dla wrogów po przeleceniu 4 razy ekranu,
    // Kro 1/3 Licznik i Timer
    // Aby wrogowie strzelali po przeleceniu 4 razy ekranu należy jeszcze zmienić update poziomu wg wzoru
    this.passCount = 0;   // Licznik przelotów
    this.shootTimer = random(0, 120); // Losowy start strzałów wroga od 0 do 2 sekund

    // --- Licznik klonowania ---
    this.cloneTimer = 0;
  }

  startExplosion() {
    this.victim = null; // Porwanie, zmiana 2/6 Natychmiastowe zerwanie nici przy wybuchu
    this.explosionFrame = 60;         // Podkręcamy czas trwania wybuchu do 60 klatek dla płynnego wygasania
    this.explosionParticles = [];     // Czyszczenie listy cząsteczek

    // Warstwa 1: Smużyste Odłamki (Linie Plasma) - 12 sztuk (Jaskrawy, neonowy seledyn)
    for (let i = 0; i < 12; i++) {
      this.explosionParticles.push({
        type: 1,
        x: this.x, y: this.y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random(1, 3)
      });
    }

    // Warstwa 2: Deszcz iskier - 18 sztuk (Żywa, szmaragdowa zieleń)
    for (let i = 0; i < 18; i++) {
      this.explosionParticles.push({
        type: 2,
        x: this.x, y: this.y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random([1, 2, 4])
      });
    }

    // Warstwa 3: Ciężkie kawałki pancerza kleszcza - 10 sztuk (Ciemna, toksyczna zieleń)
    for (let i = 0; i < 10; i++) {
      this.explosionParticles.push({
        type: 3,
        x: this.x, y: this.y,
        vx: random(-3, 3), vy: random(-3, 3),
        w: random(4, 7), h: random(2, 4)
      });
    }
  }

  update() {

    if (this.explosionFrame > 0) {
      for (let particle of this.explosionParticles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Grawitacja działająca wyłącznie na ciężkie fragmenty pancerza odwłoka (typ 3)
        if (particle.type === 3) {
          particle.vy += 0.05;
        }
      }
      this.explosionFrame--;
      return;
    }

    this.x += this.vx;
    this.y += this.vy;

    // strzały dla wrogów po przeleceniu 4 razy ekranu,
    // strzały dla wrogów Krok 2/3 
    // Logika strzelania wrogów po 3 przelotach

    this.shootTimer++;

    if (this.passCount >= 3 && !this.exploded && this.explosionFrame <= 0) {  //  wrogowie stzrelają po określonej liczbie przelotów ekranu
 // if (!this.exploded && this.explosionFrame <= 0) {   // wrogowie strzelają od razu
      if (this.shootTimer > 50) { // Strzał co 1 sekunda (60 klatek)
        this.shootTripleLaser();
        this.shootTimer = 0;
      }
    }

    // --- LOGIKA KLONOWANIA (od 5 przelotu) ---
    if (this.passCount >= 5 && !this.exploded && this.explosionFrame <= 0) {
      this.cloneTimer++;
      if (this.cloneTimer >= 600) { // czas do kolejnego klonowania 1 sekunda=60 klatek 
        this.shouldClone = true; // Zamiast wywoływać funkcję, dajemy tylko sygnał do poziomu!
        this.cloneTimer = 0; 
      }
    }

    //  Porwanie, zmiana 3/6  --- WARUNEK KOŃCA PORWANIA (20px przed krawędzią) ---
    if (this.x < 20) {
      this.victim = null; 
    }

    // Odbicie od górnej i dolnej krawędzi
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = -this.vy;
    } else if (this.y + this.radius > height) {
      this.y = height - this.radius;
      this.vy = -this.vy;
    }
  }

  show() {

    // --- NOWY SILNIK GPU: KLESZCZEXPLOSION ---
    if (this.explosionFrame > 0) {
      if (typeof window.kleszczExplosionGfx === 'undefined') {

            // ZMIANA ucinania animacji shadera 1/3-wielkość płótna z 128 na 256x256
        window.kleszczExplosionGfx = createGraphics(256, 256, WEBGL);
        window.kleszczExplosionGfx.noStroke();
        
        const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
        
        const frag = `precision mediump float;
        varying vec2 vUv;
        uniform float uProgress; 

        // Funkcja generująca pseudolosowe liczby z zakresu 0.0 do 1.0 na podstawie ID
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Funkcja obliczająca odległość punktu od odcinka (dla rysowania linii w warstwie 1)
        float dLine(vec2 p, vec2 a, vec2 b) {
            vec2 pa = p - a, ba = b - a;
            float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            return length(pa - ba * h);
        }

        void main() {
            // Przestrzeń w pikselach ekranu (od -128 do 128)
            // ZMIANA ucinania animacji shadera 2/3: Zwiększamy przestrzeń roboczą z 128.0 na 512.0
            vec2 pos = (vUv - 0.5) * 512.0;
            
            // T to odpowiednik numeru klatki (od 0 do 60)
            float T = uProgress * 60.0;
            float alphaFade = 1.0 - uProgress;

            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;

            // WARSTWA 3: Ciężkie kawałki pancerza kleszcza (10 sztuk)
            for(int i = 30; i < 40; i++) {
                float seed = float(i);
                // Losowa prędkość -3 do 3
                vec2 v = vec2(hash(vec2(seed, 3.1)), hash(vec2(seed, 3.2))) * 6.0 - 3.0; 
                
                // Grawitacja w WebGL (oś Y rośnie w górę, więc grawitacja ciągnie na minus)
                // Wzór na drogę w przyspieszeniu: s = at^2 / 2
                float drop = -0.05 * (T * T) / 2.0; 
                vec2 pCenter = vec2(v.x * T, -(v.y * T) + drop); 

                float w = hash(vec2(seed, 3.3)) * 3.0 + 4.0; // Szerokość 4 do 7
                float h = hash(vec2(seed, 3.4)) * 2.0 + 2.0; // Wysokość 2 do 4

                // Rysowanie prostokąta (ostre krawędzie, jak w oryginalnym noStroke() i rect())
                vec2 d = abs(pos - pCenter);
                if(d.x < w/2.0 && d.y < h/2.0) {
                    finalColor = vec3(0.08, 0.29, 0.1); // Ciemna, toksyczna zieleń (20, 75, 25)
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }

            // WARSTWA 2: Deszcz iskier (18 sztuk)
            for(int i = 12; i < 30; i++) {
                float seed = float(i);
                vec2 v = vec2(hash(vec2(seed, 2.1)), hash(vec2(seed, 2.2))) * 8.0 - 4.0;
                vec2 pCenter = vec2(v.x * T, -(v.y * T));

                float rnd = hash(vec2(seed, 2.3));
                float size = rnd < 0.33 ? 1.0 : (rnd < 0.66 ? 2.0 : 4.0);

                vec2 d = abs(pos - pCenter);
                if(d.x < size/2.0 && d.y < size/2.0) {
                    finalColor = vec3(0.0, 0.86, 0.31); // Szmaragdowa zieleń (0, 220, 80)
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }

            // WARSTWA 1: Smużyste Odłamki energii (12 sztuk)
            for(int i = 0; i < 12; i++) {
                float seed = float(i);
                vec2 v = vec2(hash(vec2(seed, 1.1)), hash(vec2(seed, 1.2))) * 8.0 - 4.0;
                vec2 pCenter = vec2(v.x * T, -(v.y * T));
                
                // Tworzymy linię rozciągniętą w przeciwną stronę do wektora prędkości
                vec2 a = pCenter;
                vec2 b = pCenter - vec2(v.x * 1.5, -(v.y * 1.5));
                float dist = dLine(pos, a, b);

                float size = hash(vec2(seed, 1.3)) * 2.0 + 1.0; 

                if(dist < size / 2.0) {
                    // Odpowiednik blendMode(ADD) z oryginału - dodajemy jaskrawe światło do koloru tła
                    finalColor += vec3(0.39, 1.0, 0.2); // Jaskrawy neon (100, 255, 50)
                    finalAlpha = max(finalAlpha, alphaFade);
                }
            }
            
            gl_FragColor = vec4(finalColor, finalAlpha * alphaFade);
        }`;
        
        window.kleszczExplosionShader = window.kleszczExplosionGfx.createShader(vert, frag);
      }

      window.kleszczExplosionGfx.clear();

      // Obliczanie postępu wybuchu na podstawie klatek w grze (np. 60 -> 0)
      let progress = (60.0 - this.explosionFrame) / 60.0;
      window.kleszczExplosionShader.setUniform('uProgress', progress);
      window.kleszczExplosionShader.setUniform('uTime', millis() / 1000.0);

      window.kleszczExplosionGfx.shader(window.kleszczExplosionShader);
      window.kleszczExplosionGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);

      push();
      // translate(this.x, this.y); // Odkomentuj jeśli obiekt wiruje
      // rotate(this.angle);
      imageMode(CENTER);
                                 // ZMIANA ucinania animacji shadera 2/3 na 256x256
      image(window.kleszczExplosionGfx, this.x, this.y, 256, 256);
      pop();

      this.explosionFrame--;
      return;
    }
    // --- KONIEC SILNIKA GPU ---



    //  Porwanie, zmiana 4/6 --- RYSOWANIE ŻÓŁTEJ NICI ---
    if (this.victim && !this.exploded) {
      let steps = 6; // Na ile kawałków dzielimy piorun
      let lastX = this.x;
      let lastY = this.y;
      
      for (let i = 1; i <= steps; i++) {
        // Obliczamy punkt docelowy dla każdego segmentu
        let t = i / steps;
        let targetX = lerp(this.x, this.victim.x, t);
        let targetY = lerp(this.y, this.victim.y, t);

        // Dodajemy losowe "drganie" (zygzak) dla punktów środkowych
        if (i < steps) {
          targetX += random(-4, 4);
          targetY += random(-4, 4);
        }

        // 1. Rysujemy poświatę (Pomarańczowy)
        stroke(255, 100, 0, 100);
        strokeWeight(4 + sin(frameCount * 0.2) * 2);
        line(lastX, lastY, targetX, targetY);

        // 2. Rysujemy rdzeń (Żółty)
        stroke(255, 255, 0);
        strokeWeight(1.5);
        line(lastX, lastY, targetX, targetY);

        // Przesuwamy punkt startowy dla następnego segmentu
        lastX = targetX;
        lastY = targetY;
      }
      noStroke();
    }

    // --- rysowanie wyglądu kleszcza (ZAMIAST STAREJ zielonej ELIPSY) ---
    
    // --- NOWY SILNIK GPU: KLESZCZ ---
    if (typeof window.kleszczGfx === 'undefined') {
      window.kleszczGfx = createGraphics(60, 60, WEBGL);
      window.kleszczGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float; 
varying vec2 vUv; 
uniform float uTime;

void main() {
  // 1. Inicjalizacja przestrzeni UV (-1.0 do 1.0)
  vec2 uv = (vUv - 0.5) * 2.0;
  float t = uTime * 12.0;

  // Pulsowanie w zakresie 0.0 do 1.0, uTime * 3.0 – prędkość pulsowania
  float greenPulse = sin(uTime * 4.0) * 0.5 + 0.5;

  float r = length(uv);

  // 2. Kształty i maski
  
  // Odwłok z pulsowaniem
  float pulse = sin(t) * 0.03;
  float dBody = length(uv / vec2(0.65 + pulse, 0.45 + pulse));
  float bodyFill = smoothstep(0.9, 0.85, dBody);

  // --- KOD DLA RZĘSEK ---
  // 1. Wycinamy cienki pasek tuż poza krawędzią ciała (od 0.88 do 1.06)
  float ciliaRegion = smoothstep(0.89, 0.91, dBody) * smoothstep(0.97, 0.94, dBody);
  
  // 2. Tworzymy gęste ząbki (35.0) poruszające się w prawo (- t * 2.0)
  float ciliaPattern = smoothstep(0.4, 0.6, sin(uv.x * 35.0 - t * 2.0) * 0.5 + 0.5);
  
  // 3. Łączymy maskę paska z wzorem ząbków
  float ciliaFinal = ciliaRegion * ciliaPattern;
  // ---------------------------------

  // Żuwaczki (animowane szczypce z lewej strony)
  float wag = sin(t * 1.2) * 0.35;
  float antMask = step(uv.x, -0.3) * smoothstep(-1.2, -0.6, uv.x);
  float upper = smoothstep(0.04, 0.01, abs(uv.y - (uv.x * (-0.7 - wag) - 0.05)));
  float lower = smoothstep(0.04, 0.01, abs(uv.y - (uv.x * (0.7 + wag) + 0.05)));
  float antennae = max(upper, lower) * antMask;

  // Białko oka
  vec2 eyePos = uv + vec2(0.30, 0.0);
  float eyeW = smoothstep(0.22, 0.10, length(eyePos));

  // Czerwona źrenica
  vec2 pupilPos = uv + vec2(0.35, 0.0);
  float eyeR = smoothstep(0.09, 0.06, length(pupilPos));

  // 3. Paleta kolorów bazowych
  vec3 colAntennae = vec3(0.4, 0.9, 0.4);
  vec3 colBody     = vec3(0.05, 0.2 + (greenPulse * 0.3), 0.05);
  vec3 colEyeW     = vec3(1.0, 1.0, 1.0);
  vec3 colEyeR     = vec3(0.9, 0.0, 0.0);

  // 4. Mieszanie warstw (analogicznie do dostarczonego wzoru)
  vec3 rgb = vec3(0.0);
  float alpha = 0.0;

  if (antennae > 0.0) {
      rgb = mix(rgb, colAntennae, antennae);
      alpha = max(alpha, antennae);
  }
  
  // --- BLOK RYSOWANIA RZĘSEK ---
  if (ciliaFinal > 0.0) {
      // Fala silnego światła pełzająca od lewej do prawej
      float lightFlow = sin(uv.x * 3.0 - t * 0.5) * 0.5 + 0.5;
      
      // Jaskrawa, wręcz "laserowa" zieleń wzmocniona mnożnikiem * 2.0 dla efektu HDR/Glow
      vec3 colCilia = vec3(0.0, 0.5 + (lightFlow * 0.5), 0.1) * 2.0; 
      
      rgb = mix(rgb, colCilia, ciliaFinal);
      alpha = max(alpha, ciliaFinal);
  }
  // --------------------------------------------------------------------

  if (bodyFill > 0.0) {
      // 1. Oświetlenie kierunkowe (światło z góry, cień na dole)
      float lighting = 0.6 + 0.4 * uv.y; 

      // 2. Obliczamy odległość od środka, aby nałożyć błysk (0.0 w środku, 1.0 na krawędzi)
      float distFromCenter = dBody / 0.9; 
      
      // 3. Tworzymy ostry, biały błysk (specular) bliżej środka wypukłości
      float specular = pow(max(0.0, 1.0 - distFromCenter * 1.5), 5.0) * 0.4;
      
      // 4. Łączymy pulsujący kolor z cieniami i dodajemy biały błysk
      vec3 finalBodyCol = (colBody * lighting) + vec3(specular);

      // Malujemy zmodyfikowany kolor, używając starego bodyFill jako maski
      rgb = mix(rgb, finalBodyCol, bodyFill);
      alpha = max(alpha, bodyFill);
  }
  
  if (eyeW > 0.0) {
      rgb = mix(rgb, colEyeW, eyeW);
      alpha = max(alpha, eyeW);
  }
  
  if (eyeR > 0.0) {
      rgb = mix(rgb, colEyeR, eyeR);
      alpha = max(alpha, eyeR);
  }

  // 5. Poświata (Aura)
  float auraMask = smoothstep(1.4, 0.7, dBody) * 0.4;
  vec3 auraColor = vec3(0.0, 0.15, 0.0);
  rgb += auraColor * auraMask;
  alpha = max(alpha, auraMask);

  // 6. Wygładzenie na krawędziach płótna 
  alpha *= smoothstep(1.0, 0.9, r);

  gl_FragColor = vec4(rgb, alpha);
}`;
      
      window.kleszczShader = window.kleszczGfx.createShader(vert, frag);
      // Flaga zapobiegająca wielokrotnemu odświeżaniu shadera wroga w jednej klatce
      window.lastKleszczUpdateFrame = -1;
    }
    
    // Optymalizacja: aktualizuj grafikę wroga tylko raz na klatkę
    if (window.lastKleszczUpdateFrame !== frameCount) {
      window.kleszczGfx.clear();
      window.kleszczShader.setUniform('uTime', millis() / 1000.0);
      
      // Usunąłem kod uWarn, ponieważ shader go nie przyjmował i nie przetwarzał
      
      window.kleszczGfx.shader(window.kleszczShader);
      window.kleszczGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
      
      window.lastKleszczUpdateFrame = frameCount;
    }
    
    // Narysowanie wyrenderowanej klatki na głównym ekranie gry
    push();
    imageMode(CENTER);
    image(window.kleszczGfx, this.x, this.y);
    pop();
    // --- KONIEC SILNIKA GPU ---



    // --- KONIEC rysowania wyglądy wroga Kleszcza ---


  } // <--- To jest klamra zamykająca całe show()


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
      score += this.points; // Dodano: naliczanie punktów w momencie zniszczenia wroga
      this.startExplosion();
      this.exploded = true;
      playEnemyExplosion().catch(error => console.error("Błąd wybuchu wroga:", error));

      return true;
    }
    return false;
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

  // strzały dla wrogów po przeleceniu 4 razy ekranu,
  // strzały dla wrogów Kro 3/3 
  shootTripleLaser() {
    if (typeof enemyBullets !== 'undefined') {
      let baseAngle = PI; // Kierunek w lewo
      let angleSpread = radians(25); // 25 stopni

      // Trzy strzały: prosto, góra, dół
      enemyBullets.push(new LaserWroga(this.x, this.y, baseAngle));
      enemyBullets.push(new LaserWroga(this.x, this.y, baseAngle - angleSpread));
      enemyBullets.push(new LaserWroga(this.x, this.y, baseAngle + angleSpread));
    

    }
  }

}

if (typeof window !== 'undefined') {
  window.Enemy1_zielone_kulki = Enemy1_zielone_kulki;
  window.LaserWroga = LaserWroga; // TEGO BRAKOWAŁO aby działał laser wroga
}


