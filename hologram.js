/* ORDO TECH — голографический контур.
   Вращающийся глобус с тремя городами, дугами между ними и сканирующим
   кольцом. Хроматическая кайма, строчная развёртка, лёгкое мерцание.
   Без библиотек. Останавливается, когда уходит из видимости. */
(function () {
  'use strict';

  var CSS = {
    champagne: [220, 210, 190],
    chalk:     [236, 234, 228],
    frost:     [169, 187, 194]
  };

  var CITIES = [
    { name: 'БИШКЕК', lat: 42.87, lon: 74.59 },
    { name: 'ДУБАЙ',  lat: 25.20, lon: 55.27 },
    { name: 'ЛОНДОН', lat: 51.51, lon: -0.13 }
  ];
  var LINKS = [[0, 1], [0, 2], [1, 2]];

  function start(cv) {
    var ctx = cv.getContext('2d');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // офскрины: A — сам объект белым, B — промежуточный для тонировки
    var A = document.createElement('canvas'), actx = A.getContext('2d');
    var B = document.createElement('canvas'), bctx = B.getContext('2d');
    var scan = document.createElement('canvas');          // паттерн строк
    var W = 0, H = 0, DPR = 1, R = 1, cx = 0, cy = 0, pattern = null;

    function resize() {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      W = Math.round(r.width); H = Math.round(r.height);
      [cv, A, B].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; });
      [ctx, actx, bctx].forEach(function (c) { c.setTransform(DPR, 0, 0, DPR, 0, 0); });
      cx = W / 2; cy = H / 2;
      R = Math.min(W, H) * 0.325;

      scan.width = 4; scan.height = 4;
      var sc = scan.getContext('2d');
      sc.clearRect(0, 0, 4, 4);
      sc.fillStyle = 'rgba(236,234,228,.05)';
      sc.fillRect(0, 0, 4, 1);
      pattern = ctx.createPattern(scan, 'repeat');
      return true;
    }

    // ---------- геометрия ----------
    function vec(lat, lon) {
      var a = lat * Math.PI / 180, b = lon * Math.PI / 180;
      return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
    }
    function rot(p, yaw, tilt) {
      var x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
      var z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
      var y = p[1] * Math.cos(tilt) - z * Math.sin(tilt);
      z = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
      return [x, y, z];
    }
    var D = 3.1, F = 2.45;
    function proj(p) {
      var s = F / (p[2] + D);
      return [cx + p[0] * s * R, cy - p[1] * s * R, p[2], s];
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function slerp(a, b, t) {
      var d = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
      if (d < 1e-6) return a.slice();
      var s = Math.sin(d), w1 = Math.sin((1 - t) * d) / s, w2 = Math.sin(t * d) / s;
      return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
    }
    // глубина -> непрозрачность: ближняя сторона ярче, дальняя просвечивает
    function fade(z) { return 0.16 + 0.84 * Math.max(0, Math.min(1, (z + 1) / 2)); }

    // ---------- рисование объекта (белым, в офскрин A) ----------
    var LATS = [-66, -44, -22, 0, 22, 44, 66];
    var LONS = [];
    for (var L = 0; L < 360; L += 30) LONS.push(L);

    function poly(c, pts, base, width) {
      for (var i = 0; i < pts.length - 1; i++) {
        var p = pts[i], q = pts[i + 1];
        var a = base * fade((p[2] + q[2]) / 2);
        if (a < 0.012) continue;
        c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        c.lineWidth = width;
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
    }

    function drawObject(t) {
      actx.clearRect(0, 0, W, H);
      actx.globalCompositeOperation = 'lighter';
      actx.lineCap = 'round';

      // стартовый разворот подобран так, чтобы треугольник
      // Бишкек—Дубай—Лондон был обращён к зрителю при загрузке;
      // полный оборот ~70 с — медленно, чтобы не дёргало глаз
      var yaw = -0.62 + t * 0.00009;
      var tilt = 0.18 + Math.sin(t * 0.00019) * 0.06;

      // параллели
      LATS.forEach(function (lat) {
        var pts = [];
        for (var k = 0; k <= 72; k++) pts.push(proj(rot(vec(lat, k * 5), yaw, tilt)));
        poly(actx, pts, 0.17, 1);
      });
      // меридианы
      LONS.forEach(function (lon) {
        var pts = [];
        for (var k = -90; k <= 90; k += 5) pts.push(proj(rot(vec(k, lon), yaw, tilt)));
        poly(actx, pts, 0.13, 1);
      });

      // сканирующее кольцо — яркая параллель, ходит вверх-вниз
      var sl = Math.sin(t * 0.00052) * 74;
      var ring = [];
      for (var k2 = 0; k2 <= 72; k2++) ring.push(proj(rot(vec(sl, k2 * 5), yaw, tilt)));
      poly(actx, ring, 0.72, 1.6);

      // дуги между городами + бегущие по ним импульсы
      LINKS.forEach(function (pair, idx) {
        var a = vec(CITIES[pair[0]].lat, CITIES[pair[0]].lon);
        var b = vec(CITIES[pair[1]].lat, CITIES[pair[1]].lon);
        var pts = [];
        for (var k = 0; k <= 48; k++) {
          var u = k / 48;
          var m = slerp(a, b, u);
          var lift = 1 + 0.17 * Math.sin(Math.PI * u);
          pts.push(proj(rot([m[0] * lift, m[1] * lift, m[2] * lift], yaw, tilt)));
        }
        poly(actx, pts, 0.5, 1.15);

        var ph = ((t * 0.00017) + idx * 0.37) % 1;
        var pi = Math.floor(ph * 48), p = pts[pi];
        var al = 0.95 * fade(p[2]);
        var g = actx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 13);
        g.addColorStop(0, 'rgba(255,255,255,' + (al * 0.8).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        actx.fillStyle = g;
        actx.beginPath(); actx.arc(p[0], p[1], 13, 0, 6.2832); actx.fill();
        actx.fillStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], 1.7, 0, 6.2832); actx.fill();
      });

      // маркеры городов
      var marks = [];
      CITIES.forEach(function (c, i) {
        var p = proj(rot(vec(c.lat, c.lon), yaw, tilt));
        var front = p[2] > -0.1;
        var al = fade(p[2]);
        var pulse = (t * 0.0007 + i * 0.5) % 1;

        if (front) {
          actx.strokeStyle = 'rgba(255,255,255,' + ((1 - pulse) * 0.5 * al).toFixed(3) + ')';
          actx.lineWidth = 1;
          actx.beginPath(); actx.arc(p[0], p[1], 4 + pulse * 17, 0, 6.2832); actx.stroke();
        }
        var g2 = actx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 16);
        g2.addColorStop(0, 'rgba(255,255,255,' + (0.7 * al).toFixed(3) + ')');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        actx.fillStyle = g2;
        actx.beginPath(); actx.arc(p[0], p[1], 16, 0, 6.2832); actx.fill();
        actx.fillStyle = 'rgba(255,255,255,' + Math.min(1, al * 1.1).toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], 2.4, 0, 6.2832); actx.fill();

        marks.push({ x: p[0], y: p[1], name: c.name, a: front ? al : 0 });
      });

      actx.globalCompositeOperation = 'source-over';
      return marks;
    }

    // ---------- тонированный композит ----------
    function tint(rgb, dx, dy, alpha) {
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, W, H);
      bctx.drawImage(A, 0, 0, W, H);
      bctx.globalCompositeOperation = 'source-in';
      bctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      bctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = alpha;
      ctx.drawImage(B, dx, dy, W, H);
      ctx.globalAlpha = 1;
    }

    var glitchUntil = 0, glitchY = 0, nextGlitch = 2600;

    function frame(t) {
      if (!W) { if (!resize()) { requestAnimationFrame(frame); return; } }

      var marks = drawObject(reduce ? 8000 : t);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // подсветка «проектора» снизу
      var bg = ctx.createRadialGradient(cx, cy + R * 1.15, 0, cx, cy + R * 1.15, R * 1.5);
      bg.addColorStop(0, 'rgba(220,210,190,.085)');
      bg.addColorStop(1, 'rgba(220,210,190,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // мерцание — едва заметное, иначе выглядит дёшево
      var flick = reduce ? 1 : 0.93 + 0.07 * Math.sin(t * 0.011) * Math.sin(t * 0.0031);

      // хроматическая кайма: тёплая влево, холодная вправо
      var sp = reduce ? 0 : 1.15 + Math.sin(t * 0.0013) * 0.5;
      tint(CSS.champagne, -sp, 0, 0.62 * flick);
      tint(CSS.frost, sp, 0, 0.5 * flick);
      tint(CSS.chalk, 0, 0, 0.78 * flick);

      ctx.globalCompositeOperation = 'source-over';

      // подписи городов — поверх, без каймы, чтобы читались
      ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      marks.forEach(function (m) {
        if (m.a < 0.4) return;
        var a = (m.a - 0.4) / 0.6;
        ctx.strokeStyle = 'rgba(220,210,190,' + (a * 0.3).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 15, m.y); ctx.stroke();
        ctx.fillStyle = 'rgba(236,234,228,' + (a * 0.62).toFixed(3) + ')';
        ctx.fillText(m.name, m.x + 20, m.y + 0.5);
      });

      // строчная развёртка
      if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, W, H); }

      // редкий короткий срыв строки
      if (!reduce) {
        if (t > nextGlitch) {
          glitchUntil = t + 90 + Math.random() * 70;
          glitchY = Math.random() * H;
          nextGlitch = t + 3200 + Math.random() * 5200;
        }
        if (t < glitchUntil) {
          var gy = Math.round(glitchY * DPR);
          var gh = Math.round((10 + Math.random() * 26) * DPR);
          if (gy + gh > cv.height) gh = cv.height - gy;
          if (gh > 2) {
            try {
              var slice = ctx.getImageData(0, gy, cv.width, gh);
              ctx.putImageData(slice, Math.round((Math.random() * 14 - 7) * DPR), gy);
            } catch (e) { /* не критично */ }
          }
        }
      }

    }

    // ---------- цикл с паузой, когда герой уехал за экран ----------
    var visible = true, looping = false;
    function loop(t) {
      if (!visible) { looping = false; return; }
      frame(t);
      if (reduce) { looping = false; return; }
      requestAnimationFrame(loop);
    }
    function run() { if (!looping) { looping = true; requestAnimationFrame(loop); } }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) run();
      }, { threshold: 0 }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) run();
    });
    addEventListener('resize', function () { W = 0; run(); });
    run();
  }

  // рантайм отрисовывает страницу асинхронно — ждём появления канваса
  var tries = 0;
  (function wait() {
    var cv = document.getElementById('ordo-holo');
    if (cv) { start(cv); return; }
    if (++tries < 200) setTimeout(wait, 60);
  })();
})();
