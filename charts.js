/* ============================================================
   charts.js — the three D3 readouts on johnsonmugarra.com
   ------------------------------------------------------------
   All three charts draw into a fixed viewBox, so the SVG scales
   with its container and never needs redrawing on resize or when a
   hidden tab is revealed. The only redraw trigger is a theme
   change, because the axis and tooltip inks come from CSS
   custom properties.
   ============================================================ */
'use strict';

(function () {
  if (!window.d3) return;
  const d3 = window.d3;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Shared helpers ──────────────────────────────────────── */

  /** Linear congruential PRNG. Seeded so the "data" is identical on every visit. */
  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** Box–Muller transform, drawing from the supplied uniform source. */
  function gaussian(rand, mean, stdDev) {
    const u1 = Math.max(1e-10, rand());
    const u2 = rand();
    return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
  }

  function logUniform(rand, lo, hi) {
    return Math.exp(Math.log(lo) + rand() * (Math.log(hi) - Math.log(lo)));
  }

  /** Chart inks live in tailwind.css so light and dark stay in one place. */
  function inks() {
    const cs = getComputedStyle(document.documentElement);
    const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      text: read('--chart-text', 'rgba(237,230,216,0.72)'),
      axis: read('--chart-axis', 'rgba(237,230,216,0.2)'),
      grid: read('--chart-grid', 'rgba(237,230,216,0.07)'),
      /* Painted behind labels as a stroke, so it follows the chart tray
         rather than the page. */
      halo: read('--chart-halo', 'rgba(237,230,216,0.9)'),
      label: read('--chart-label', 'rgba(237,230,216,0.55)'),
      tipInk: read('--chart-tip-ink', 'rgba(237,230,216,0.92)'),
      tipDim: read('--chart-tip-dim', 'rgba(237,230,216,0.55)'),
      bandMain: read('--chart-band-main', '#6fbf82'),
      bandSecond: read('--chart-band-second', '#c99a5e'),
      /* Series colours come from the same tokens the HTML legends use,
         so a swatch always matches the mark it describes. Light mode
         darkens them; the dark-mode values are unreadable on cream. */
      legit: read('--s-legit', '#30d158'),
      suspicious: read('--s-suspicious', '#ff9f0a'),
      fraud: read('--s-fraud', '#ff453a'),
      pollination: read('--s-pollination', '#5ba3a8'),
      harvest: read('--s-harvest', '#6e6e73'),
      east: read('--s-east', '#34785f'),
      /* Tree of life domains. The legend swatches in the markup read the
         same tokens, so a dot always matches the branches beside it. */
      eukaryota: read('--s-pollination', '#0064ce'),
      bacteria: read('--s-suspicious', '#9a5c00'),
      archaea: read('--s-east', '#34785f'),
    };
  }

  /** Hex to `rgb(r g b / a)`, for the tinted threshold zone and rules. */
  function withAlpha(hex, alpha) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
    if (!m) return hex;
    const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
    return `rgb(${r} ${g} ${b} / ${alpha})`;
  }

  /**
   * Tooltips are absolutely positioned, so they must be appended to the
   * nearest positioned ancestor and measured against that same element.
   * The old code measured against the inner chart div while the browser
   * positioned against the padded wrapper, which put every tooltip 16px off.
   */
  function tooltipFor(mount) {
    const host = mount.closest('.chart-surface') || mount;
    d3.select(host).selectAll('.chart-tooltip').remove();
    const node = d3.select(host).append('div').attr('class', 'chart-tooltip');
    return {
      show(event, html) {
        const box = host.getBoundingClientRect();
        let left = event.clientX - box.left + 14;
        const top = event.clientY - box.top - 56;
        if (left + 250 > box.width) left = event.clientX - box.left - 226;
        /* The -56 sits the box above the pointer, which puts it outside the
           tray whenever the pointer is near the top edge. The tree of life
           hits that on every label in the top quarter of the circle. */
        node.style('display', 'block').style('left', `${Math.max(4, left)}px`).style('top', `${Math.max(4, top)}px`).html(html);
      },
      hide() {
        node.style('display', 'none');
      },
    };
  }

  /**
   * Wires a group of aria-pressed buttons to a callback.
   * Bound once at startup, unlike the old code which re-cloned every
   * button on each redraw and re-attached listeners to the clones.
   */
  function bindFilterGroup(selector, attr, onChange) {
    const group = document.querySelector(selector);
    if (!group) return () => 'All';
    let active = 'All';
    group.addEventListener('click', (event) => {
      const btn = event.target.closest(`button[${attr}]`);
      if (!btn) return;
      const value = btn.getAttribute(attr);
      if (value === active) return;
      active = value;
      group.querySelectorAll(`button[${attr}]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value));
      });
      onChange(value);
    });
    return () => active;
  }

  /** Renders on theme flips; each chart registers its own draw function. */
  const redrawHandlers = [];
  document.addEventListener('themechange', () => redrawHandlers.forEach((fn) => fn()));

  /* ============================================================
     Vanilla harvest season model
     ============================================================ */

  (function vanillaChart() {
    const mount = document.getElementById('vanilla-chart');
    if (!mount) return;

    const DURATION = reduceMotion ? 0 : 450;
    const MONTHS =['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    /** Beans mature roughly 9 months after hand-pollination. */
    const MATURATION_MONTHS = 9;
    /** Flowers per kilogram of cured bean, used for the harvest readout. */
    const FLOWERS_PER_KG = 5.6;

    const rand = seededRandom(20240315);
    const regionProfiles = { West: { mean: 608, sd: 25 }, Central: { mean: 400, sd: 10 }, East: { mean: 100, sd: 6 } };

    const farmers = [];
    for (let i = 0; i < 1000; i++) {
      const roll = rand();
      const region = roll < 0.6 ? 'West' : roll < 0.9 ? 'Central' : 'East';
      const profile = regionProfiles[region];
      farmers.push({ region, basePeak: Math.max(18, gaussian(rand, profile.mean, profile.sd)) });
    }

    /* Seasonal multiplier by calendar month. Two pollination peaks:
       Sep–Nov (main) and Feb–May (secondary). */
    const SEASONAL = [0.1, 0.44, 0.8, 1.0, 0.82, 0.06, 0.05, 0.14, 0.54, 0.94, 0.69, 0.07];

    const series = [];
    let month = 3;
    let year = 2023;
    for (let i = 0; i < 39; i++) {
      const yearFactor = 1 + (year - 2022) * 0.055;
      const seasonFactor = SEASONAL[month];
      const sums = { West: 0, Central: 0, East: 0 };
      const counts = { West: 0, Central: 0, East: 0 };
      farmers.forEach((farmer) => {
        const expected = farmer.basePeak * seasonFactor * yearFactor * 26;
        sums[farmer.region] += Math.max(0, expected + (rand() - 0.5) * expected * 0.3);
        counts[farmer.region]++;
      });
      series.push({
        date: new Date(year, month, 15),
        West: counts.West ? sums.West / counts.West : 0,
        Central: counts.Central ? sums.Central / counts.Central : 0,
        East: counts.East ? sums.East / counts.East : 0,
        All: (sums.West + sums.Central + sums.East) / farmers.length,
      });
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    /* The harvest line is the pollination line shifted forward 9 months. */
    const pollinationWindow = series.slice(MATURATION_MONTHS, 39);
    const harvestWindow = series.slice(0, 39 - MATURATION_MONTHS);

    function linesFor(region) {
      return {
        pollination: pollinationWindow.map((d) => ({ date: d.date, value: d[region] })),
        harvest: harvestWindow.map((d, i) => ({ date: pollinationWindow[i].date, value: d[region] })),
      };
    }

    const yMax = d3.max(
      ['All', 'West', 'Central', 'East'].flatMap((region) => {
        const l = linesFor(region);
        return l.pollination.concat(l.harvest).map((d) => d.value);
      })
    );

    const harvestBands = [
      { start: new Date(2024, 5, 1), end: new Date(2024, 7, 1), kind: 'main' },
      { start: new Date(2024, 11, 1), end: new Date(2025, 1, 1), kind: 'secondary' },
      { start: new Date(2025, 5, 1), end: new Date(2025, 7, 1), kind: 'main' },
      { start: new Date(2025, 11, 1), end: new Date(2026, 1, 1), kind: 'secondary' },
      { start: new Date(2026, 5, 1), end: new Date(2026, 7, 1), kind: 'main' },
    ];

    let activeRegion = 'All';
    let update = null;

    const getRegion = bindFilterGroup('[data-chart-controls="vanilla"]', 'data-region', (region) => {
      activeRegion = region;
      if (update) update(region, true);
    });

    function draw() {
      activeRegion = getRegion();
      const ink = inks();
      /* The band fills used to be literal rgba values while only the
         labels read the palette, so the shading kept its old hue after a
         retheme and disagreed with its own legend swatch. Both now come
         off the same token. */
      const tint = (hex, alpha) => {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
      };

      const bandStyles = {
        main: { fill: tint(ink.bandMain, 0.13), stroke: tint(ink.bandMain, 0.45), label: ink.bandMain, text: 'Main harvest' },
        secondary: { fill: tint(ink.bandSecond, 0.13), stroke: tint(ink.bandSecond, 0.4), label: ink.bandSecond, text: '2nd harvest' },
      };

      d3.select(mount).selectAll('svg').remove();

      const TOTAL_W = 960;
      const TOTAL_H = 490;
      const margin = { top: 40, right: 22, bottom: 64, left: 74 };
      const width = TOTAL_W - margin.left - margin.right;
      const height = TOTAL_H - margin.top - margin.bottom;

      const svg = d3
        .select(mount)
        .append('svg')
        .attr('viewBox', `0 0 ${TOTAL_W} ${TOTAL_H}`)
        .attr('role', 'img')
        .attr('aria-label', 'Simulated pollination activity and projected vanilla harvest, January 2024 to June 2026')
        .attr('style', 'max-width:100%;height:auto;display:block;overflow:visible');

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleTime().domain([new Date(2024, 0, 1), new Date(2026, 6, 15)]).range([0, width]);
      const y = d3.scaleLinear().domain([0, yMax * 1.12]).range([height, 0]).nice();

      const bandLayer = g.append('g').attr('aria-hidden', 'true');
      harvestBands.forEach((band) => {
        const x1 = Math.max(0, x(band.start));
        const x2 = Math.min(width, x(band.end));
        if (x2 <= x1) return;
        const style = bandStyles[band.kind];
        bandLayer
          .append('rect')
          .attr('x', x1)
          .attr('y', 0)
          .attr('width', x2 - x1)
          .attr('height', height)
          .attr('fill', style.fill)
          .attr('stroke', style.stroke)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3');
        bandLayer
          .append('text')
          .attr('x', (x1 + x2) / 2)
          .attr('y', -10)
          .attr('text-anchor', 'middle')
          .attr('fill', style.label)
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .text(style.text);
      });

      g.append('g')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''))
        .call((sel) => {
          sel.select('.domain').remove();
          sel.selectAll('line').attr('stroke', ink.grid).attr('stroke-dasharray', '3,5');
        });

      const xAxis = g
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(2)).tickFormat(d3.timeFormat('%b %Y')).tickSizeOuter(0));
      xAxis
        .selectAll('text')
        .style('fill', ink.text)
        .style('font-size', '10px')
        .attr('transform', 'rotate(-38)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.4em')
        .attr('dy', '0.15em');
      xAxis.select('.domain').style('stroke', ink.axis);
      xAxis.selectAll('.tick line').style('stroke', ink.axis);

      const yAxis = g.append('g').call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickFormat((d) => (d >= 1000 ? `${(d / 1000).toFixed(1)}k` : d))
          .tickSizeOuter(0)
      );
      yAxis.selectAll('text').style('fill', ink.text).style('font-size', '10px');
      yAxis.select('.domain').style('stroke', ink.axis);
      yAxis.selectAll('.tick line').style('stroke', ink.axis);

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -60)
        .attr('text-anchor', 'middle')
        .attr('fill', ink.label)
        .attr('font-size', '10.5px')
        .text('Avg. flowers per farmer per month');

      const line = d3
        .line()
        .x((d) => x(d.date))
        .y((d) => y(d.value))
        .curve(d3.curveCatmullRom.alpha(0.5));

      const pollinationPath = g
        .append('path')
        .attr('fill', 'none')
        .attr('stroke', ink.pollination)
        .attr('stroke-width', 2.4)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round');

      const harvestPath = g
        .append('path')
        .attr('fill', 'none')
        .attr('stroke', ink.harvest)
        .attr('stroke-width', 2.4)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', '7,3');

      update = (region, animate) => {
        const l = linesFor(region);
        if (animate && DURATION) {
          pollinationPath.transition().duration(DURATION).attr('d', line(l.pollination));
          harvestPath.transition().duration(DURATION).attr('d', line(l.harvest));
        } else {
          pollinationPath.attr('d', line(l.pollination));
          harvestPath.attr('d', line(l.harvest));
        }
      };
      update(activeRegion, false);

      const tip = tooltipFor(mount);
      const bisectDate = d3.bisector((d) => d.date).left;
      const crosshair = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', ink.axis)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .style('display', 'none');

      g.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mousemove', (event) => {
          const l = linesFor(activeRegion);
          const index = Math.min(bisectDate(l.pollination, x.invert(d3.pointer(event)[0]), 1), l.pollination.length - 1);
          const point = l.pollination[index];
          const harvest = l.harvest[index];
          if (!point) return;

          crosshair.attr('x1', x(point.date)).attr('x2', x(point.date)).style('display', null);

          const m = point.date.getMonth();
          const yr = point.date.getFullYear();
          const pollinatedOn = new Date(yr, m - MATURATION_MONTHS, 1);
          const flowers = Math.round(point.value).toLocaleString('en-GB');
          const kilos = Math.round(harvest.value / FLOWERS_PER_KG).toLocaleString('en-GB');

          let html =
            `<strong style="color:${ink.tipInk}">${MONTHS[m]} ${yr}</strong> ` +
            `<span style="color:${ink.tipDim};font-size:10px">(${activeRegion} Uganda)</span><br>` +
            `<span style="color:${ink.pollination}">Pollination: </span><strong>${flowers}</strong> flowers<br>` +
            `<span style="color:${ink.harvest}">Harvest: </span><strong>${kilos}</strong> kg ` +
            `<span style="color:${ink.tipDim};font-size:10px">(from ${MONTHS[pollinatedOn.getMonth()]} ${pollinatedOn.getFullYear()})</span>`;
          if (m === 5 || m === 6) html += `<br><span style="color:${ink.bandMain};font-size:10px;font-weight:600">Main harvest period</span>`;
          if (m === 11 || m === 0) html += `<br><span style="color:${ink.bandSecond};font-size:10px;font-weight:600">Secondary harvest period</span>`;

          tip.show(event, html);
        })
        .on('mouseleave', () => {
          crosshair.style('display', 'none');
          tip.hide();
        });
    }

    draw();
    redrawHandlers.push(draw);
  })();

  /* ============================================================
     Transaction fraud detection model
     ============================================================ */

  (function fraudChart() {
    const mount = document.getElementById('fraud-chart');
    if (!mount) return;

    const DURATION = reduceMotion ? 0 : 380;
    const THRESHOLD = 0.5;

    /* Resolved per draw so a theme flip repaints the marks, the legend
       swatches and the stats figures together. */
    const statusColours = () => {
      const ink = inks();
      return { Legitimate: ink.legit, Suspicious: ink.suspicious, Fraud: ink.fraud };
    };
    const STATUS_OPACITY = { Legitimate: 0.48, Suspicious: 0.75, Fraud: 0.92 };
    const STATUS_RADIUS = { Legitimate: 3.5, Suspicious: 4.5, Fraud: 5.5 };
    /* Painted in this order so fraud lands on top of the legitimate cloud. */
    const PAINT_ORDER = ['Legitimate', 'Suspicious', 'Fraud'];

    /* Plausible amount ranges per channel and per outcome, in USD. */
    const AMOUNTS = {
      Online: { legit: [8, 900], suspicious: [300, 5000], fraud: [600, 22000] },
      ATM: { legit: [20, 500], suspicious: [200, 2000], fraud: [400, 6000] },
      POS: { legit: [4, 400], suspicious: [150, 3000], fraud: [800, 15000] },
      Wire: { legit: [150, 9000], suspicious: [3000, 30000], fraud: [9000, 95000] },
    };

    const rand = seededRandom(20240201);
    const transactions = [];
    for (let i = 0; i < 2000; i++) {
      const channelRoll = rand();
      const channel = channelRoll < 0.4 ? 'Online' : channelRoll < 0.6 ? 'ATM' : channelRoll < 0.9 ? 'POS' : 'Wire';
      const outcomeRoll = rand();
      let status;
      let risk;
      let amount;

      if (outcomeRoll < 0.83) {
        status = 'Legitimate';
        risk = Math.min(0.94, Math.max(0.004, gaussian(rand, 0.11, 0.08)));
        amount = logUniform(rand, ...AMOUNTS[channel].legit);
        /* A few honest large purchases, so the cloud has a realistic tail. */
        if (rand() < 0.04) amount *= 1.8 + rand() * 3.5;
      } else if (outcomeRoll < 0.93) {
        status = 'Suspicious';
        risk = Math.min(0.89, Math.max(0.22, gaussian(rand, 0.5, 0.14)));
        amount = logUniform(rand, ...AMOUNTS[channel].suspicious);
      } else {
        status = 'Fraud';
        risk = Math.min(0.998, Math.max(0.36, gaussian(rand, 0.77, 0.13)));
        amount = logUniform(rand, ...AMOUNTS[channel].fraud);
      }
      transactions.push({ channel, status, risk: +risk.toFixed(4), amount: +amount.toFixed(2) });
    }

    const painted = transactions.slice().sort((a, b) => PAINT_ORDER.indexOf(a.status) - PAINT_ORDER.indexOf(b.status));
    const statsEl = document.getElementById('fraud-stats');

    function updateStats(channel) {
      if (!statsEl) return;
      const visible = channel === 'All' ? transactions : transactions.filter((t) => t.channel === channel);
      const total = visible.length;
      if (!total) {
        statsEl.textContent = 'No transactions on this channel.';
        return;
      }
      const fraud = visible.filter((t) => t.status === 'Fraud').length;
      const suspicious = visible.filter((t) => t.status === 'Suspicious').length;
      const pct = (n) => ((n / total) * 100).toFixed(1);
      /* var() keeps these live: the figures follow a theme flip on
         their own, with no redraw. */
      statsEl.innerHTML =
        `<strong>${total.toLocaleString('en-GB')}</strong> transactions &nbsp;·&nbsp; ` +
        `<span style="color:var(--s-fraud)"><strong>${fraud}</strong> fraud (${pct(fraud)}%)</span> &nbsp;·&nbsp; ` +
        `<span style="color:var(--s-suspicious)"><strong>${suspicious}</strong> suspicious (${pct(suspicious)}%)</span>`;
    }

    let activeChannel = 'All';
    let applyFilter = null;

    const getChannel = bindFilterGroup('[data-chart-controls="fraud"]', 'data-channel', (channel) => {
      activeChannel = channel;
      if (applyFilter) applyFilter(channel);
      updateStats(channel);
    });

    function draw() {
      activeChannel = getChannel();
      const ink = inks();
      const STATUS_COLOUR = statusColours();

      d3.select(mount).selectAll('svg').remove();

      const TOTAL_W = 960;
      const TOTAL_H = 480;
      const margin = { top: 30, right: 28, bottom: 58, left: 84 };
      const width = TOTAL_W - margin.left - margin.right;
      const height = TOTAL_H - margin.top - margin.bottom;

      const svg = d3
        .select(mount)
        .append('svg')
        .attr('viewBox', `0 0 ${TOTAL_W} ${TOTAL_H}`)
        .attr('role', 'img')
        .attr('aria-label', '2,000 synthetic transactions plotted by predicted risk score against amount')
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'visible');

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
      const y = d3.scaleLog().domain([3.5, 130000]).range([height, 0]).nice();

      g.append('g')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''))
        .call((sel) => {
          sel.select('.domain').remove();
          sel.selectAll('line').attr('stroke', ink.grid).attr('stroke-dasharray', '3,5');
        });

      /* Everything right of the threshold is what the model would flag. */
      const thresholdX = x(THRESHOLD);
      g.append('rect')
        .attr('x', thresholdX)
        .attr('y', 0)
        .attr('width', width - thresholdX)
        .attr('height', height)
        .attr('fill', withAlpha(ink.fraud, 0.06));
      g.append('line')
        .attr('x1', thresholdX)
        .attr('x2', thresholdX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', withAlpha(ink.fraud, 0.6))
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '7,4');
      g.append('text')
        .attr('x', thresholdX + 6)
        .attr('y', 18)
        .attr('fill', ink.fraud)
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.06em')
        .text('RISK THRESHOLD');

      const xAxis = g
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('.1f')).tickSizeOuter(0));
      xAxis.selectAll('text').style('fill', ink.text).style('font-size', '10px');
      xAxis.select('.domain').style('stroke', ink.axis);
      xAxis.selectAll('.tick line').style('stroke', ink.axis);
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 46)
        .attr('text-anchor', 'middle')
        .attr('fill', ink.label)
        .attr('font-size', '10.5px')
        .text('Predicted risk score');

      const yAxis = g.append('g').call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickFormat((d) => (d >= 1000 ? `$${(d / 1000).toFixed(0)}k` : `$${d}`))
          .tickSizeOuter(0)
      );
      yAxis.selectAll('text').style('fill', ink.text).style('font-size', '10px');
      yAxis.select('.domain').style('stroke', ink.axis);
      yAxis.selectAll('.tick line').style('stroke', ink.axis);
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -68)
        .attr('text-anchor', 'middle')
        .attr('fill', ink.label)
        .attr('font-size', '10.5px')
        .text('Transaction amount (USD)');

      const dots = g
        .append('g')
        .selectAll('circle')
        .data(painted)
        .join('circle')
        .attr('cx', (d) => x(d.risk))
        .attr('cy', (d) => y(Math.max(3.5, d.amount)))
        .attr('r', (d) => STATUS_RADIUS[d.status])
        .attr('fill', (d) => STATUS_COLOUR[d.status])
        .attr('fill-opacity', (d) => STATUS_OPACITY[d.status])
        .style('cursor', 'crosshair');

      applyFilter = (channel) => {
        const shown = (d) => channel === 'All' || d.channel === channel;
        dots
          .transition()
          .duration(DURATION)
          .attr('fill-opacity', (d) => (shown(d) ? STATUS_OPACITY[d.status] : 0))
          .attr('r', (d) => (shown(d) ? STATUS_RADIUS[d.status] : 0));
      };
      applyFilter(activeChannel);
      updateStats(activeChannel);

      const tip = tooltipFor(mount);

      dots
        .on('mouseover', function (event, d) {
          if (activeChannel !== 'All' && d.channel !== activeChannel) return;
          d3.select(this).raise().transition().duration(80).attr('r', STATUS_RADIUS[d.status] + 2.5).attr('fill-opacity', 1);

          let html =
            `<strong style="color:${STATUS_COLOUR[d.status]}">${d.status}</strong> ` +
            `<span style="color:${ink.tipDim};font-size:10px">· ${d.channel}</span><br>` +
            `<span style="color:${ink.tipDim}">Amount: </span>` +
            `<strong style="color:${ink.tipInk}">$${d.amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong><br>` +
            `<span style="color:${ink.tipDim}">Risk score: </span>` +
            `<strong style="color:${STATUS_COLOUR[d.status]}">${(d.risk * 100).toFixed(1)}%</strong>`;
          if (d.risk >= THRESHOLD && d.status === 'Legitimate') {
            html += `<br><span style="color:${STATUS_COLOUR.Suspicious};font-size:10px">False positive</span>`;
          }
          if (d.risk < THRESHOLD && d.status === 'Fraud') {
            html += `<br><span style="color:${STATUS_COLOUR.Fraud};font-size:10px">Undetected fraud</span>`;
          }
          tip.show(event, html);
        })
        .on('mouseleave', function (event, d) {
          tip.hide();
          const shown = activeChannel === 'All' || d.channel === activeChannel;
          d3.select(this)
            .transition()
            .duration(80)
            .attr('r', shown ? STATUS_RADIUS[d.status] : 0)
            .attr('fill-opacity', shown ? STATUS_OPACITY[d.status] : 0);
        });
    }

    draw();
    redrawHandlers.push(draw);
  })();

  /* ============================================================
     Tree of life
     ------------------------------------------------------------
     A radial cluster of the three domains, rebuilt from the D3
     gallery notebook of the same name by Mike Bostock. The Newick
     string and the layout maths are his; what this version changes
     is the palette, which now reads the theme tokens like the two
     charts above, and the interaction, which reports a lineage on
     hover instead of only bolding a branch.

     The data is fetched rather than inlined because a Newick string
     is one unreadable line and inlining it would put 12kB of tree
     syntax in the middle of this file. It is kept in the repo, so
     the fetch is same-origin and survives the upstream host moving
     or rate-limiting the file.
     ============================================================ */

  (function treeOfLifeChart() {
    const mount = document.getElementById('tree-chart');
    if (!mount) return;

    const DURATION = reduceMotion ? 0 : 750;
    const DATA_URL = 'data/life.txt';

    /** Square viewBox. The SVG is wider than the labels need, so the
        whole circle sits in the centre of whatever box it lands in. */
    const SIZE = 960;
    const outerRadius = SIZE / 2;
    /** Ring width leaves room for the leaf labels outside it. */
    const innerRadius = outerRadius - 170;
    /** Extra ring outside the branch tips for the extension stubs. */
    const EXTENSION = 10;

    const DOMAIN_ORDER = ['Eukaryota', 'Bacteria', 'Archaea'];

    let data = null;
    let loadError = null;
    /* Both are no-ops until draw() has run, so a theme flip that lands
       mid-fetch cannot throw. */
    let paint = () => {};
    let applyLength = null;

    /**
     * Newick parser, from Jason Davies' newick.js, which is what the
     * notebook credits. Reads ( , ) : and branch lengths, and ignores
     * the [support] values in square brackets.
     */
    function parseNewick(a) {
      for (var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0; t < s.length; t++) {
        var n = s[t];
        switch (n) {
          case '(':
            var c = {};
            r.branchset = [c];
            e.push(r);
            r = c;
            break;
          case ',':
            var c = {};
            e[e.length - 1].branchset.push(c);
            r = c;
            break;
          case ')':
            r = e.pop();
            break;
          case ':':
            break;
          default:
            var h = s[t - 1];
            ')' == h || '(' == h || ',' == h ? (r.name = n) : ':' == h && (r.length = parseFloat(n));
        }
      }
      return r;
    }

    function labelFor(node) {
      return (node.data.name || '').replace(/_/g, ' ');
    }

    /** Longest root-to-leaf distance in the tree. */
    function maxLength(d) {
      return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
    }

    /** Radius per node, scaled so the longest branch ends on the ring. */
    function setRadius(d, y0, k) {
      d.radius = (y0 += d.data.length) * k;
      if (d.children) d.children.forEach((child) => setRadius(child, y0, k));
    }

    /** Each node inherits its domain's colour from the nearest ancestor
        that declares one, which is why only the three roots are keyed. */
    function setColor(d, palette) {
      const name = d.data.name;
      d.color = DOMAIN_ORDER.includes(name) ? palette[name] : d.parent ? d.parent.color : null;
      if (d.children) d.children.forEach((child) => setColor(child, palette));
    }

    /** Elbow from one polar point to another: an arc, then a radius. */
    function linkStep(startAngle, startRadius, endAngle, endRadius) {
      const c0 = Math.cos((startAngle = (startAngle - 90) / 180 * Math.PI));
      const s0 = Math.sin(startAngle);
      const c1 = Math.cos((endAngle = (endAngle - 90) / 180 * Math.PI));
      const s1 = Math.sin(endAngle);
      return (
        'M' + startRadius * c0 + ',' + startRadius * s0 +
        (endAngle === startAngle ? '' : 'A' + startRadius + ',' + startRadius + ' 0 0 ' + (endAngle > startAngle ? 1 : 0) + ' ' + startRadius * c1 + ',' + startRadius * s1) +
        'L' + endRadius * c1 + ',' + endRadius * s1
      );
    }

    const linkConstant = (d) => linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
    const linkVariable = (d) => linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
    const extensionConstant = (d) => linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
    const extensionVariable = (d) => linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);

    function draw() {
      if (!data) return;
      const ink = inks();
      const palette = { Eukaryota: ink.eukaryota, Bacteria: ink.bacteria, Archaea: ink.archaea };

      d3.select(mount).selectAll('svg').remove();

      const root = d3
        .hierarchy(data, (d) => d.branchset)
        .sum((d) => (d.branchset ? 0 : 1))
        .sort((a, b) => a.value - b.value || d3.ascending(a.data.length, b.data.length));

      d3.cluster().size([360, innerRadius]).separation(() => 1)(root);
      root.data.length = 0;
      setRadius(root, root.data.length, innerRadius / maxLength(root));
      setColor(root, palette);

      const svg = d3
        .select(mount)
        .append('svg')
        .attr('viewBox', `${-outerRadius} ${-outerRadius} ${SIZE} ${SIZE}`)
        .attr('role', 'img')
        .attr(
          'aria-label',
          'Radial cluster tree of life in three domains: Eukaryota, Bacteria and Archaea. Each branch is a clade and its length is the evolutionary distance from its ancestor.'
        )
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'visible');

      svg.append('circle')
        .attr('r', innerRadius)
        .attr('fill', 'none')
        .attr('stroke', ink.axis)
        .attr('stroke-dasharray', '2,6');

      /* Only the links that end on a leaf get an extension stub, which is
         what makes a collapsed clade read as "there is more in here". */
      const extensions = svg
        .append('g')
        .attr('fill', 'none')
        /* Fallback ink on the group as well as per link. The parser wraps
           the tree in an unnamed root that declares no domain, so its one
           link resolves to no colour and would otherwise vanish. The
           notebook covers the same case by setting stroke on the group. */
        .attr('stroke', ink.axis)
        .attr('stroke-opacity', 0.25)
        .selectAll('path')
        .data(root.links().filter((d) => !d.target.children))
        .join('path')
        .each(function (d) {
          d.target.extensionNode = this;
        })
        .attr('d', extensionConstant)
        .attr('stroke', (d) => d.target.color);

      const links = svg
        .append('g')
        .attr('fill', 'none')
        .attr('stroke', ink.axis)
        .selectAll('path')
        .data(root.links())
        .join('path')
        .each(function (d) {
          d.target.linkNode = this;
        })
        .attr('d', linkConstant)
        .attr('stroke', (d) => d.target.color);

      const labels = svg
        .append('g')
        .selectAll('text')
        .data(root.leaves())
        .join('text')
        .attr('dy', '.31em')
        .attr('transform', (d) => `rotate(${d.x - 90}) translate(${innerRadius + EXTENSION},0)${d.x < 180 ? '' : ' rotate(180)'}`)
        .attr('text-anchor', (d) => (d.x < 180 ? 'start' : 'end'))
        .attr('fill', ink.text)
        .attr('font-size', '10px')
        .text(labelFor);

      /* ═══ Interactions ═══════════════════════════════════════ */

      applyLength = (showLength) => {
        const t = d3.transition().duration(DURATION);
        extensions.transition(t).attr('d', showLength ? extensionVariable : extensionConstant);
        links.transition(t).attr('d', showLength ? linkVariable : linkConstant);
      };

      const tip = tooltipFor(mount);

      /** Root to leaf, so a hover reports which clade the tip sits in.
          The Newick file nests several ranks under one name, so a run of
          identical names collapses to one entry with a count. Reading
          "Eukaryota subclade ×6" is both shorter and more accurate than
          printing the same six words on separate lines. */
      function lineage(d) {
        const names = [];
        for (let node = d; node.parent; node = node.parent) {
          const name = labelFor(node);
          const last = names[names.length - 1];
          if (last && last.name === name) last.count++;
          else names.push({ name, count: 1 });
        }
        return names
          .map((entry) => (entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name))
          .join(' › ');
      }

      /* The shared tooltip positions itself from the pointer. The pointer here
         belongs to a leaf label rather than to a mark in the plot area, but
         the labels sit inside the chart surface, so its offsets are still
         measured against a box that contains them and it needs no special
         handling. */
      function hover(event, d) {
        tip.show(
          event,
          `<strong style="color:${ink.tipInk}">${labelFor(d)}</strong><br>` +
            `<span style="color:${d.color};font-size:10px;font-weight:600">${DOMAIN_ORDER.find((name) => d.color === palette[name]) || ''}</span><br>` +
            `<span style="color:${ink.tipDim};font-size:10px;line-height:1.5">${lineage(d)}</span>`
        );
      }

      /** Bolds the hovered branch and everything above it, so the lineage
          in the tooltip is visible in the tree as well as in the text. */
      function highlight(node, on) {
        for (let d = node; d; d = d.parent) {
          d3.select(d.linkNode).attr('stroke', on ? ink.text : d.target.color).attr('stroke-width', on ? 1.8 : 1);
          d3.select(d.extensionNode).attr('stroke-opacity', on ? 0.6 : 0.25);
        }
      }

      labels
        .on('mouseover', function (event, d) {
          d3.select(this).attr('fill', ink.tipInk).attr('font-weight', 'bold');
          highlight(d, true);
          hover(event, d);
        })
        .on('mouseout', function (event, d) {
          d3.select(this).attr('fill', ink.text).attr('font-weight', null);
          highlight(d, false);
          tip.hide();
        });

      paint = draw;
    }

    function renderMessage(message) {
      d3.select(mount).selectAll('*').remove();
      d3.select(mount)
        .append('p')
        .attr('class', 'flex h-full items-center justify-center text-center text-sm text-muted')
        .text(message);
    }

    /* ═══ Wiring ═══════════════════════════════════════════════ */

    const toggle = document.getElementById('tree-length');
    toggle?.addEventListener('change', (event) => {
      if (applyLength) applyLength(event.target.checked);
    });

    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        data = parseNewick(text);
        draw();
      })
      .catch((error) => {
        loadError = error;
        renderMessage('The tree of life data could not be loaded.');
      });

    /* A theme flip is the only reason this chart repaints, so the redraw
       is registered up front and simply does nothing until the fetch has
       landed. The catch also re-renders the message, because it is written
       in theme tokens and the old one would sit on the wrong background. */
    redrawHandlers.push(() => {
      if (data) paint();
      else if (loadError) renderMessage('The tree of life data could not be loaded.');
    });
  })();

/* ============================================================
     Thematic codebook
     ------------------------------------------------------------
     Rebuilt from the Radial tidy tree notebook in the D3 gallery by
     Mike Bostock, which draws a software class hierarchy as a radial
     tidy tree. A codebook has the same shape, so the layout, the link
     geometry and the halo labels are his and are kept as they are.

     What changes is what the two radial coordinates carry. In the
     notebook the radius is depth and the angle is a tidy split of the
     circle, one equal slice per leaf. Here the radius is still depth,
     but the angle is weighted: a branch is drawn as wide as the coded
     excerpts beneath it, so a reader can see which themes the corpus
     actually rests on. The display toggle puts the notebook's even
     split back, because an encoding whose effect cannot be seen is
     just a claim.

     One structural note. The notebook labels every node from inside
     the node's own rotated group, so a label is part of the thing it
     names and inherits its hover. That is kept here: the circle and
     its text live in a single <g>, which is why there is one set of
     event handlers rather than two parallel selections to keep in
     step across a redraw.

     What the notebook does not have to solve is this chart's label
     budget. A radial layout spends one radial band per labelled level,
     and three bands of outward labels do not fit a square beside a
     readable font size. So the themes and the codes are labelled, the
     sub-themes are left as their ring of dots and named on hover, and
     the code labels alternate between two bands. Every node still
     reports its own name and its full path in the tooltip and in its
     accessible name, so nothing is unreachable, only unlabelled.
     ============================================================ */

  (function codebookChart() {
    const mount = document.getElementById('codebook-chart');
    if (!mount) return;

    const DURATION = reduceMotion ? 0 : 650;
    const DATA_URL = 'data/codebook.json';

    /* A square viewBox, so the circle is undistorted. The notebook's own
       1152 with a 100 margin is the wrong proportion here: the tray is
       square, so a 1152 viewBox would scale down by the ratio between the
       two and put the label text under 6px on screen.

       The tray is therefore sized to match the viewBox, which keeps one
       unit very close to one pixel and makes the font sizes below mean
       what they say. The margin is generous because the outermost band
       belongs to the code labels, not to the tree. */
    const SIZE = 920;
    const MARGIN = 160;
    const outerRadius = (SIZE - MARGIN * 2) / 2;

    /* Five top-level themes, keyed to the same series tokens the tree of
       life and the legend swatches use, so a branch colour always matches
       the swatch that names it. */
    const THEMES = {
      'Record availability': 'pollination',
      'Paperless readiness': 'suspicious',
      'Workflow and workload': 'east',
      'Data quality and reconciliation': 'harvest',
      'Facilitators and barriers': 'fraud',
    };
    const LEVELS = ['Theme', 'Sub-theme', 'Code'];

    /* The codebook is wrapped in an unnamed root so the themes share a
       parent, which shifts every real level down by one: a theme sits at
       depth 1. These two keep the reader-facing level out of that
       arithmetic.

       Depth, not height. d3.hierarchy's height is the distance from a node
       down to its deepest descendant, so a code has height 0 and the root
       has height 3. Reading the level off height silently inverts the
       whole hierarchy. */
    const levelIndex = (d) => Math.max(0, Math.min(d.depth - 1, LEVELS.length - 1));
    const levelName = (d) => LEVELS[levelIndex(d)];

    let data = null;
    let loadError = null;
    let paint = () => {};
    let setWeighting = null;
    let applyFilter = null;
    let readFilter = () => 'All';

    function labelFor(node) {
      return (node.data && node.data.name) || '';
    }

    /** The root is a container for the themes, not a code, so it is never
        labelled and never given a name to read. */
    const isRoot = (d) => d.depth === 0;

    /** Innermost theme above a node, which is what the swatches name. */
    function themeOf(node) {
      for (let d = node; d; d = d.parent) {
        if (d.data && THEMES[labelFor(d)]) return labelFor(d);
      }
      return '';
    }

    /**
     * d3.tree gives every leaf an equal slice of the circle. A codebook is
     * not evenly distributed, so each leaf is instead allotted a span in
     * proportion to its excerpt count and every internal node takes the
     * union of its children. Child order is left alone, so siblings stay
     * contiguous and the result is still the tidy layout.
     *
     * Only called when weighting is on. Otherwise d3.tree's own even split
     * stands, which is the other half of what the toggle is for.
     */
    function weightAngles(root, total) {
      let cursor = 0;
      (function walk(node) {
        if (node.children) {
          const from = cursor;
          node.children.forEach(walk);
          node.span = cursor - from;
        } else {
          node.span = node.value;
          cursor += node.value;
        }
        /* Mid-angle of the span, in radians clockwise from twelve. */
        node.x = ((cursor - node.span / 2) / total) * 2 * Math.PI;
      })(root);
    }

    /**
     * One branch, as a cubic that leaves its parent along the parent's
     * radius and arrives at its child along the child's. Both control
     * points sit on their own end's radius, so the tangent is radial at
     * both ends and the curve flows out of one dot and into the next.
     *
     * The notebook's own link is an elbow: an arc along the parent's
     * circle, then a straight radius to the child. On a tree with this
     * many nodes that puts a hard right angle at every branch point, and
     * forty-odd right angles read as scaffolding. This is the same shape
     * d3-shape's linkRadial draws.
     */
    function linkStep(startAngle, startRadius, endAngle, endRadius) {
      const span = endRadius - startRadius;
      const grip = span * 0.42;
      const a0 = startAngle - Math.PI / 2;
      const a1 = endAngle - Math.PI / 2;
      const pt = (r, a) => `${r * Math.cos(a)},${r * Math.sin(a)}`;
      return (
        'M' + pt(startRadius, a0) +
        'C' + pt(startRadius + grip, a0) + ' ' + pt(endRadius - grip, a1) + ' ' + pt(endRadius, a1)
      );
    }

    const linkPath = (d) => linkStep(d.source.x, d.source.y, d.target.x, d.target.y);

    function renderMessage(message) {
      d3.select(mount).selectAll('*').remove();
      d3.select(mount)
        .append('p')
        .attr('class', 'flex h-full items-center justify-center text-center text-sm text-muted')
        .text(message);
    }

    function draw() {
      if (!data) return;
      const ink = inks();
      const palette = Object.fromEntries(Object.entries(THEMES).map(([name, token]) => [name, ink[token]]));

      d3.select(mount).selectAll('svg').remove();

      const svg = d3
        .select(mount)
        .append('svg')
        .attr('viewBox', `${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`)
        .attr('role', 'img')
        .attr(
          'aria-label',
          'Radial tidy tree of a thematic codebook. Five themes branch into sub-themes and then into individual codes. Distance from the centre is the level in the code hierarchy, and the width of a branch is the number of coded excerpts filed under it.'
        )
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'visible');

      const rings = svg.append('g').attr('fill', 'none').attr('stroke', ink.grid).attr('stroke-dasharray', '2,6');
      const linkLayer = svg.append('g').attr('fill', 'none');
      const nodeLayer = svg.append('g');
      const tip = tooltipFor(mount);

      let root = null;
      let maxCount = 1;
      let activeTheme = 'All';
      let weighted = document.getElementById('codebook-weight')?.checked !== false;

      /** Node dots are large enough to be the thing the eye lands on, and a
          code is scaled by its share of the corpus on a log scale so one
          large code cannot swallow the ring. */
      function radiusOf(d) {
        if (isRoot(d)) return 0;
        if (!d.children) return 3.4 + 3.4 * (Math.log(d.value + 1) / Math.log(maxCount + 1));
        return d.depth === 1 ? 5.4 : 4.5;
      }

      /* Branches carry more ink than the notebook's 1.5, to match the
         larger dots they land on. */
      const linkWidth = (d) => (d.target.children ? 2 : 1.4);
      const nodeTransform = (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`;

      /** Offset of a label from its dot. The notebook sends a leaf's label
          outward and an internal node's inward, which keeps a fully
          labelled tree from colliding with itself. Here sub-themes carry
          no label, so there is no reason for two directions: every label
          points outward from the centre, and the five long theme names
          stop piling over each other in the middle of the circle.

          Code labels alternate between two radial bands. A codebook puts
          narrow themes beside wide ones, so a label and its angular
          neighbour collide well before either runs out of room. */
      function labelOffset(d) {
        const outward = d.x < Math.PI ? 1 : -1;
        const stagger = !d.children ? (d.leafIndex % 2) * 15 : 0;
        return outward * (9 + stagger);
      }

      /** Themes and codes carry a visible label; sub-themes do not, and
          the root never does. Sub-theme names live in the tooltip, the
          accessible name and the stats line instead. */
      const labelled = (d) => !isRoot(d) && d.depth !== 2;

      function describe(d) {
        return `${labelFor(d)}. ${levelName(d)} under ${themeOf(d)}. ${d.value} coded excerpts.`;
      }

      function hover(event, d) {
        const theme = themeOf(d);
        const trail = d
          .ancestors()
          .reverse()
          .map(labelFor)
          .filter(Boolean)
          .join(' > ');
        tip.show(
          event,
          `<strong style="color:${ink.tipInk}">${labelFor(d)}</strong><br>` +
            `<span style="color:${palette[theme]};font-size:10px;font-weight:600">${theme}</span><br>` +
            `<span style="color:${ink.tipDim};font-size:10px">${levelName(d)} &middot; <strong style="color:${ink.tipInk}">${d.value}</strong> excerpts<br>${trail}</span>`
        );
      }

      /** Bolds the hovered branch and everything above it, so the path in
          the tooltip is visible in the tree as well as in the text. */
      function highlight(node, on) {
        for (let d = node; d; d = d.parent) {
          linkLayer
            .selectAll('path')
            .filter((l) => l.target === d)
            .attr('stroke-width', (l) => (on ? (l.target.children ? 2.4 : 1.9) : linkWidth(l)))
            .attr('stroke-opacity', (l) => (on ? 0.95 : activeTheme === 'All' || themeOf(l.target) === activeTheme ? 0.55 : 0.05));
        }
      }

      function updateStats(theme) {
        const stats = document.getElementById('codebook-stats');
        if (!stats || !root) return;
        const total = root.value;
        if (theme === 'All') {
          stats.innerHTML =
            `<strong>${total.toLocaleString('en-GB')}</strong> coded excerpts across ` +
            `<strong>${root.leaves().length}</strong> codes in <strong>${root.children.length}</strong> themes`;
          return;
        }
        const branch = root.children.find((d) => labelFor(d) === theme);
        if (!branch) return;
        const pct = ((branch.value / total) * 100).toFixed(1);
        stats.innerHTML =
          `<strong>${branch.value.toLocaleString('en-GB')}</strong> coded excerpts across ` +
          `<strong>${branch.leaves().length}</strong> codes under ` +
          `<span style="color:${palette[theme]};font-weight:600">${theme}</span>` +
          ` &nbsp;&middot;&nbsp; <strong>${pct}%</strong> of the corpus`;
      }

      /** Dims everything outside the chosen theme. Angular position is left
          alone on purpose: the arcs still show each theme's true share of
          the corpus, and dimming a branch is a reading aid rather than a
          second, contradictory encoding. */
      applyFilter = (theme) => {
        activeTheme = theme;
        const shown = (d) => theme === 'All' || themeOf(d) === theme;
        linkLayer
          .selectAll('path')
          .attr('stroke-opacity', (d) => (shown(d.target) ? 0.55 : 0.05))
          .attr('stroke-width', linkWidth);
        nodeLayer.selectAll('g').attr('opacity', (d) => (shown(d) ? 1 : 0.14));
        updateStats(theme);
      };

      function rebuild(animate) {
        /* The file's own top level is the study, not a code, so the
           themes hang off an unnamed root. That keeps the study name in the
           file for a reader of the data and out of the drawing. */
        root = d3
          .hierarchy({ children: data.children }, (d) => d.children)
          .sum((d) => (d.children ? 0 : d.count || 0))
          .sort((a, b) => b.value - a.value || d3.ascending(a.data.name, b.data.name));

        /* The notebook's separation: siblings close, cousins further apart,
           both scaled by depth so the ring spacing stays even. */
        d3
          .tree()
          .size([2 * Math.PI, outerRadius])
          .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(root);

        if (weighted) weightAngles(root, root.value);
        maxCount = d3.max(root.leaves(), (d) => d.value);
        /* Leaves come back in angular order, which is the order the
           stagger alternates through. */
        root.leaves().forEach((d, i) => {
          d.leafIndex = i;
        });

        const t = animate && DURATION ? d3.transition().duration(DURATION) : null;
        const pick = (sel) => (t ? sel.transition(t) : sel);

        /* One faint ring per level the tree actually uses, so the radius
           axis is legible as a level and not only as a distance. */
        const radiusByDepth = new Map();
        root.each((d) => radiusByDepth.set(d.depth, d.y));
        pick(rings.selectAll('circle').data([...radiusByDepth.keys()]).join('circle'))
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', (depth) => radiusByDepth.get(depth));

        const links = linkLayer.selectAll('path').data(root.links()).join('path');
        links
          .attr('stroke', (d) => palette[themeOf(d.target)])
          .attr('stroke-width', linkWidth)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round');
        pick(links).attr('d', linkPath);

        /* The node group carries both the dot and its label, as in the
           notebook, so the label is hoverable and follows the dot.

           The children are appended rather than reached with
           selectAll().data().join(): that form binds to the join's own
           parent node, so on a selection which is itself a join result it
           files every circle and every label into a single group. append()
           is the API that means one child per element of the selection. */
        nodeLayer.selectAll('*').remove();
        const nodes = nodeLayer.selectAll('g').data(root.descendants()).join('g');
        pick(nodes).attr('transform', nodeTransform);

        nodes
          .attr('tabindex', 0)
          .attr('role', 'button')
          .attr('aria-label', describe)
          .on('mouseenter', function (event, d) {
            highlight(d, true);
            hover(event, d);
          })
          .on('mouseleave', function (event, d) {
            tip.hide();
            highlight(d, false);
          })
          .on('focus', function (event, d) {
            highlight(d, true);
            hover(event, d);
          })
          .on('blur', function (event, d) {
            tip.hide();
            highlight(d, false);
          });

        nodes
          .append('circle')
          .attr('r', radiusOf)
          .attr('fill', (d) => (d.children ? palette[themeOf(d)] : 'none'))
          .attr('stroke', (d) => palette[themeOf(d)])
          .attr('stroke-width', (d) => (d.children ? 2 : 2.2));

        /* Sub-themes and the root keep the dot alone; the filter is what keeps
           the text elements from being appended to every node. */
        nodes
          .filter(labelled)
          .append('text')
          /* Flip the label on the left half of the circle so it reads
             outward rather than upside down. */
          .attr('transform', (d) => `rotate(${d.x >= Math.PI ? 180 : 0})`)
          .attr('dy', '0.32em')
          .attr('x', labelOffset)
          .attr('text-anchor', (d) => (d.x < Math.PI ? 'start' : 'end'))
          .attr('font-size', (d) => (d.depth === 1 ? 10 : 9))
          .attr('font-weight', (d) => (d.depth === 1 ? 600 : null))
          .attr('fill', (d) => (d.depth === 1 ? ink.tipInk : ink.text))
          /* The notebook's halo, which is what lets a label cross a branch
             and still be read. It needs a surface token rather than a flat
             white, or the labels read as pale rectangles on cream. */
          .attr('paint-order', 'stroke')
          .attr('stroke', ink.halo)
          .attr('stroke-width', 3)
          .attr('stroke-linejoin', 'round')
          .text(labelFor);

        /* Keep the active filter across a re-layout. */
        applyFilter(activeTheme);
      }

      rebuild(false);

      setWeighting = (on, animate) => {
        weighted = on;
        rebuild(animate);
      };

      paint = draw;
    }

    /* ── Wiring ───────────────────────────────────────────────── */

    readFilter = bindFilterGroup('[data-chart-controls="codebook"]', 'data-theme', (theme) => {
      if (applyFilter) applyFilter(theme);
    });

    document.getElementById('codebook-weight')?.addEventListener('change', (event) => {
      if (setWeighting) setWeighting(event.target.checked, true);
    });

    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        data = json;
        draw();
        if (applyFilter) applyFilter(readFilter());
      })
      .catch((error) => {
        loadError = error;
        renderMessage('The codebook data could not be loaded.');
      });

    /* A theme flip is the only reason this chart repaints, so the redraw is
       registered up front and does nothing until the fetch has landed. */
    redrawHandlers.push(() => {
      if (data) paint();
      else if (loadError) renderMessage('The codebook data could not be loaded.');
    });
  })();

  /* ============================================================
     Word cloud
     ------------------------------------------------------------
     Rebuilt from the Word cloud notebook in the D3 gallery, which is
     a demonstration of d3-cloud rather than of D3 itself. The text
     is Martin Luther King Jr's 1963 speech, as in the notebook.

     Two departures from the notebook, both for this page:

       The ink is applied as a CSS custom property rather than a
       resolved colour, so a theme flip recolours the cloud without
       re-running the layout. This chart therefore registers no
       redraw handler, which is the point: the sprite collision
       pass is randomised, so a redraw would scatter every word to a
       new place each time the reader toggled the theme.

       Words are buffered and flushed in one go under reduced
       motion, so the cloud appears settled rather than assembling
       itself word by word.
     ============================================================ */

  (function wordCloudChart() {
    const mount = document.getElementById('cloud-chart');
    if (!mount) return;
    /* d3-cloud attaches itself to the d3 namespace as d3.layout.cloud.
       It is a separate library from d3, so a blocked CDN leaves this
       panel empty rather than breaking the charts above it. */
    if (!window.d3 || !d3.layout || !d3.layout.cloud) return;

    const WIDTH = 960;
    const HEIGHT = 480;
    const MAX_WORDS = 120;
    /* Word size scales with the square root of the count, which is the
       notebook's formula and keeps a word twice as frequent from
       looking four times as important. */
    const FONT_SCALE = 13;
    const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    /** The most frequent words carry the accent, the rest recede. */
    const ACCENT = 14;
    const ROTATED_SHARE = 0.16;

    /* The notebook's list, trimmed of the contractions it carries. */
    const STOPWORDS = new Set(
      ('i,me,my,myself,we,us,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,' +
        'she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,whose,' +
        'this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,' +
        'will,would,should,can,could,ought,isnt,arent,wasnt,werent,hasnt,havent,hadnt,doesnt,dont,didnt,' +
        'wont,wouldnt,shant,shouldnt,cant,cannot,couldnt,mustnt,lets,thats,whos,whats,heres,theres,when,' +
        'where,whys,hows,a,an,the,and,but,if,or,because,as,until,while,of,at,by,for,with,about,against,' +
        'between,into,through,during,before,after,above,below,to,from,up,upon,down,in,out,on,off,over,' +
        'under,again,further,then,once,here,there,when,where,why,how,all,any,both,each,few,more,most,' +
        'other,some,such,no,nor,not,only,own,same,so,than,too,very,say,says,said,shall')
        .split(',')
    );

    /** Strip punctuation at both ends, drop possessives, cap the length. */
    function tokenize(text) {
      return text
        .split(/[\s.]+/g)
        .map((w) => w.replace(/^[“‘"()[\]{}-]+/g, ''))
        .map((w) => w.replace(/[;:.!?()[\]{},"'’-]+$/g, ''))
        .map((w) => w.replace(/['’]s$/g, ''))
        .map((w) => w.substring(0, 30).toLowerCase())
        .filter((w) => w && !STOPWORDS.has(w));
    }

    function renderMessage(message) {
      d3.select(mount).selectAll('*').remove();
      d3.select(mount)
        .append('p')
        .attr('class', 'flex h-full items-center justify-center text-center text-sm text-muted')
        .text(message);
    }

    function draw(words) {
      d3.select(mount).selectAll('*').remove();

      const ink = inks();
      const svg = d3
        .select(mount)
        .append('svg')
        .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
        .attr('role', 'img')
        .attr('aria-label', 'Word cloud of the most frequent words in the 1963 speech I Have a Dream, sized by how often each word appears')
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'visible');

      const layer = svg.append('g').attr('text-anchor', 'middle');
      const tip = tooltipFor(mount);

      function place(word) {
        const accent = words.indexOf(word) < ACCENT;
        layer
          .append('text')
          .datum(word)
          .attr('font-size', word.size)
          .attr('font-family', FONT)
          .attr('transform', `translate(${word.x},${word.y}) rotate(${word.rotate})`)
          /* var() on the inline style is what lets a theme flip recolour
             the cloud without touching the layout. */
          .style('fill', accent ? 'var(--s-pollination)' : 'var(--chart-text)')
          .style('fill-opacity', accent ? null : 0.72)
          .style('cursor', 'crosshair')
          .text(word.text)
          .on('mouseover', function (event, d) {
            d3.select(this).style('fill', accent ? ink.tipInk : ink.tipInk).attr('font-weight', 'bold');
            tip.show(
              event,
              `<strong style="color:${ink.tipInk}">${d.text}</strong><br>` +
                `<span style="color:${ink.tipDim};font-size:10px">appears </span>` +
                `<strong style="color:${ink.pollination}">${d.size}</strong>` +
                `<span style="color:${ink.tipDim};font-size:10px"> times</span>`
            );
          })
          .on('mouseleave', function () {
            d3.select(this).attr('font-weight', null).style('fill', accent ? 'var(--s-pollination)' : 'var(--chart-text)');
            tip.hide();
          });
      }

      const placed = [];
      const cloud = d3.layout
        .cloud()
        .size([WIDTH, HEIGHT])
        .words(words)
        .padding(2)
        .font(FONT)
        .fontSize((d) => Math.sqrt(d.size) * FONT_SCALE)
        /* A minority of words sit on their side. Rotating every word,
           as the notebook's own example does, is unreadable. */
        .rotate(() => (Math.random() < ROTATED_SHARE ? 90 : 0))
        .on('word', (word) => {
          placed.push(word);
          if (!reduceMotion) place(word);
        })
        .on('end', () => {
          if (reduceMotion) placed.forEach(place);
          const stats = document.getElementById('cloud-stats');
          if (stats) {
            stats.innerHTML =
              `<strong>${words.length}</strong> most frequent words &nbsp;·&nbsp; ` +
              `<span style="color:var(--s-pollination)"><strong>${words[0].size}</strong> appearances of "${words[0].text}"</span>`;
          }
        });

      cloud.start();
    }

    fetch('data/dream.txt')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        const counts = d3.rollups(tokenize(text), (group) => group.length, (w) => w)
          .sort(([, a], [, b]) => d3.descending(a, b))
          .slice(0, MAX_WORDS)
          .map(([word, size]) => ({ text: word, size }));
        if (!counts.length) throw new Error('no words');
        draw(counts);
      })
      .catch(() => renderMessage('The word cloud text could not be loaded.'));
  })();

  /* ============================================================
     Seamless zoomable map tiles
     ------------------------------------------------------------
     Rebuilt from the Seamless zoomable map tiles notebook in the
     D3 gallery. The trick it demonstrates is layering: while the
     full-resolution tiles for the current zoom are still loading,
     coarser tiles from four zoom levels down are already on screen
     underneath them. Without them a pan flashes the background.

     The notebook opens on the north pole, because its initial
     transform is anchored to world pixel zero. This one opens on
     Kampala.

     This is the only chart here that is not self-contained. Map
     tiles are raster images fetched from opentopomap.org as the
     reader pans, which is why the attribution below the map is not
     optional.
     ============================================================ */

  (function mapTilesChart() {
    const mount = document.getElementById('map-chart');
    if (!mount) return;
    if (!window.d3 || !d3.tile) return;

    const WIDTH = 960;
    const HEIGHT = 520;
    /** Tile edge in screen pixels. d3-tile doubles the standard 256, so
        a tile covers two columns of the usual slippy scheme. */
    const TILE_SIZE = 512;
    /** Slippy zoom level to open at. */
    const ZOOM = 6;
    /** The transform scale that puts d3-tile on that zoom level:
        it reads z = log2(transform.k / tileSize). */
    const K = TILE_SIZE * Math.pow(2, ZOOM);
    /** Kampala. The notebook's own initial transform lands on the north pole. */
    const CENTRE = { lon: 32.5825, lat: 0.3476 };
    /** Zoom deltas below the current level, coarsest first. Two levels down
        is enough to cover the gap without fetching tiles nobody sees. */
    const DELTAS = [-4, -1, 0];
    const TILE_URL = (x, y, z) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`;

    /** Tile index of a lon/lat at a slippy zoom level, in the 256px scheme
        that tile.opentopomap.org addresses. This is also d3-tile's index:
        doubling tileSize changes how wide a tile is drawn, not how the
        world is divided. Getting that wrong fetches a valid tile of the
        wrong place, which looks like a map and is not one. */
    function tileIndex(lon, lat, z) {
      const n = Math.pow(2, z);
      const phi = (lat * Math.PI) / 180;
      return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n];
    }

    /**
     * A transform putting Kampala in the middle of the viewport.
     *
     * d3-tile draws tile (tx, ty) at screen tx * tileScale, with
     * tileScale = TILE_SIZE here and an offset of transform.x - k / 2,
     * so the centre wants
     *
     *     tx * TILE_SIZE + transform.x - K / 2 = WIDTH / 2
     *
     * The translate has to be divided by K because zoomIdentity scales
     * an x or y added after .scale(), but not one added before it.
     */
    function initialTransform() {
      const [tx, ty] = tileIndex(CENTRE.lon, CENTRE.lat, ZOOM);
      const x = WIDTH / 2 - tx * TILE_SIZE + K / 2;
      const y = HEIGHT / 2 - ty * TILE_SIZE + K / 2;
      return d3.zoomIdentity.scale(K).translate(x / K, y / K);
    }

    d3.select(mount).selectAll('*').remove();

    const svg = d3
      .select(mount)
      .append('svg')
      .attr('class', 'tile-map')
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .attr('role', 'img')
      .attr('aria-label', 'Zoomable topographic map centred on Kampala, Uganda. Drag to pan and scroll to zoom.')
      .style('width', '100%')
      .style('height', '100%');

    const tile = d3.tile().extent([[0, 0], [WIDTH, HEIGHT]]).tileSize(TILE_SIZE).clampX(false);
    const readout = document.getElementById('map-readout');

    const zoom = d3
      .zoom()
      .scaleExtent([1 << 8, 1 << 22])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (event) => {
        const transform = event.transform;
        const base = Math.log2(transform.k / TILE_SIZE);
        /* Zoomed out far enough, two deltas resolve to the same clamped
           zoom level. Drawing both would stack identical tiles, so each
           level is only filled the first time it comes up. */
        const drawn = new Set();
        levels.each(function (delta) {
          const z0 = Math.max(Math.round(base + delta), 0);
          if (drawn.has(z0)) {
            d3.select(this).selectAll('image').remove();
            return;
          }
          drawn.add(z0);
          const tiles = tile.zoomDelta(delta)(transform);
          d3.select(this)
            .selectAll('image')
            .data(tiles, (d) => d)
            .join('image')
            .attr('href', (d) => TILE_URL(...d3.tileWrap(d)))
            .attr('x', ([x]) => (x + tiles.translate[0]) * tiles.scale)
            .attr('y', ([, y]) => (y + tiles.translate[1]) * tiles.scale)
            .attr('width', tiles.scale)
            .attr('height', tiles.scale);
        });
        /* The slippy zoom this actually requested, which is not the same
           number as log2(transform.k) once the tile size is folded in. */
        if (readout) readout.textContent = `Zoom ${Math.max(base, 0).toFixed(1)} of ${ZOOM}`;
      });

    /* Three layers, coarsest first, so the low-resolution tiles sit
       underneath the ones actually on screen. */
    const levels = svg
      .append('g')
      .attr('pointer-events', 'none')
      .selectAll('g')
      .data(DELTAS)
      .join('g');

    svg.call(zoom).call(zoom.transform, initialTransform());

    /* ═══ Controls ═════════════════════════════════════════════ */

    /* Fades every layer so the low-resolution ones behind become
       visible. Off, they are doing their job unseen. */
    const layerToggle = document.getElementById('map-layers');
    layerToggle?.addEventListener('change', (event) => {
      levels.style('opacity', event.target.checked ? 0.3 : null);
    });

    document.getElementById('map-reset')?.addEventListener('click', () => {
      svg.transition().duration(reduceMotion ? 0 : 650).call(zoom.transform, initialTransform());
    });
  })();
})();
