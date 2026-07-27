/* ============================================================
   charts.js — the two D3 readouts on johnsonmugarra.com
   ------------------------------------------------------------
   Both charts draw into a fixed viewBox, so the SVG scales with
   its container and never needs redrawing on resize or when a
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
      harvest: read('--s-harvest', '#e8a020'),
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
        node.style('display', 'block').style('left', `${Math.max(4, left)}px`).style('top', `${top}px`).html(html);
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
      const bandStyles = {
        main: { fill: 'rgba(46,160,67,0.13)', stroke: 'rgba(46,160,67,0.45)', label: ink.bandMain, text: 'Main harvest' },
        secondary: { fill: 'rgba(160,110,50,0.13)', stroke: 'rgba(160,110,50,0.4)', label: ink.bandSecond, text: '2nd harvest' },
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
      /* var() rather than a resolved value: the figures then follow a
         theme flip on their own, with no redraw. */
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
})();
