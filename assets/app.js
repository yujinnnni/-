// 轻量事件系统与工具
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function setActiveTab(tabId) {
  $$('.tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
}

// 动态生成5次输入行
function ensureRow5() {
  $$('.row5').forEach(container => {
    if (container.children.length > 0) return;
    const name = container.getAttribute('data-name');
    for (let i = 1; i <= 5; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.0001';
      input.name = `${name}_${i}`;
      input.placeholder = `第${i}次`;
      container.appendChild(input);
    }
  });
}

// 通用：将步骤文本追加到列表
function appendSteps(listEl, steps) {
  listEl.innerHTML = '';
  steps.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    listEl.appendChild(li);
  });
}

// 通用：设置最终结果
function setFinal(selector, text) {
  const el = document.querySelector(`[data-final="${selector}"]`);
  if (el) el.textContent = text;
}

// 数字格式化
const fmt = {
  fixed: (v, d) => (Number.isFinite(v) ? v.toFixed(d) : ''),
};

// 物性与分度表（简化插值/标准多项式）
const lookup = {
  // 空气密度与运动黏度（近似，20–80℃，标准大气）
  air: {
    T: [0, 10, 20, 30, 40, 50, 60, 70, 80],
    rho: [1.275, 1.247, 1.205, 1.165, 1.127, 1.093, 1.060, 1.029, 1.000],
    nu:  [1.31e-5,1.43e-5,1.51e-5,1.60e-5,1.69e-5,1.78e-5,1.88e-5,1.98e-5,2.09e-5]
  },
  // 水密度与运动黏度（近似，10–80℃）
  water: {
    T: [10, 20, 30, 40, 50, 60, 70, 80],
    rho: [999.7, 998.2, 995.7, 992.2, 988.1, 983.2, 977.8, 971.8],
    nu:  [1.31e-6,1.00e-6,0.80e-6,0.66e-6,0.55e-6,0.47e-6,0.41e-6,0.36e-6]
  },
  // 热电偶：E(mV)→t(℃)（支持表格插值/多项式）
  tc: {
    // K型：使用提供的分度表（每10℃节点的mV），在mV轴上线性插值反查温度
    // 数据来源：你提供的表中“整数温度列(×10℃)”对应的mV（0–340℃）。
    K: {
      mode: 'table_interp_mv_to_t',
      T:   [  0,  10,  20,  30,  40,  50,  60,  70,  80,  90,
             100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
             200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
             300, 310, 320, 330, 340 ],
      E:   [0.000,0.397,0.798,1.203,1.611,2.023,2.436,2.850,3.266,3.681,
             4.095,4.509,4.919,5.327,5.733,6.137,6.539,6.939,7.338,7.737,
             8.137,8.537,8.938,9.341,9.745,10.151,10.560,10.969,11.381,11.793,
             12.207,12.623,13.039,13.456,13.874]
    },
    // E型：采用你提供的表（第二页可见 410–850 ℃ 首列mV），
    // 如需更宽温区可继续补点
    E: {
      mode: 'table_interp_mv_to_t',
      T: [410,420,430,440,450,460,470,480,490,500,
          510,520,530,540,550,560,570,580,590,600,
          610,620,630,640,650,660,670,680,690,700,
          710,720,730,740,750,760,770,780,790,800,
          810,820,830,840,850],
      E: [29.747,30.550,31.354,32.165,32.965,33.772,34.573,35.375,36.176,36.978,
          37.815,38.624,39.434,40.243,41.053,41.862,42.671,43.479,44.286,45.093,
          45.900,46.706,47.509,48.313,49.116,49.917,50.718,51.517,52.315,53.112,
          53.903,54.703,55.497,56.288,57.080,57.870,58.659,59.448,60.232,61.017,
          61.801,62.586,63.366,64.144,64.922]
    },
    T: {
      mode: 'table_interp_mv_to_t',
      T: [  0,  10,  20,  30,  40,  50,  60,  70,  80,  90,
           100, 110, 120, 130, 140, 150, 160 ],
      E: [0.000,0.391,0.790,1.196,1.612,2.036,2.468,2.909,3.358,3.814,
           4.279,4.750,5.228,5.714,6.206,6.704,7.209]
    }
  },
  // 热电阻：支持表格插值/公式
  rtd: {
    // Pt100 使用你提供的表（-40~240℃ 每10℃首列电阻值），按电阻轴线性插值反查温度
    Pt100: {
      mode: 'table_interp_R_to_t',
      T: [-40,-30,-20,-10,  0, 10, 20, 30, 40, 50,
           60, 70, 80, 90,100,110,120,130,140,150,
          160,170,180,190,200,210,220,230,240],
      R: [84.27,88.22,92.16,96.09,100.00,103.90,107.79,111.67,115.54,119.40,
          123.24,127.08,130.90,134.71,138.51,142.29,146.07,149.83,153.58,157.33,
          161.05,164.77,168.47,172.17,175.86,179.53,183.19,186.84,190.47]
    },
    // Cu50：使用你提供的表（节选：0–150℃ 每10℃节点第一列电阻值）
    // 若需更细的1℃分度，可后续补点，插值逻辑无需改动
    Cu50: {
      mode: 'table_interp_R_to_t',
      T: [  0,  10,  20,  30,  40,  50,  60,  70,  80,  90,
           100, 110, 120, 130, 140, 150],
      R: [50.000,52.144,54.285,56.426,58.565,60.704,62.842,64.981,67.120,69.259,
           71.400,73.542,75.686,77.833,79.982,82.134]
    }
  },
  // 孔板 α* 与 Re 的粗略表（示例插值，需按教材表细化）
  alpha_of_Re: [
    { Re: 5e3, alpha: 0.60 },
    { Re: 1e4, alpha: 0.61 },
    { Re: 5e4, alpha: 0.62 },
    { Re: 1e5, alpha: 0.63 },
    { Re: 5e5, alpha: 0.64 },
    { Re: 1e6, alpha: 0.65 }
  ]
};

function lerp(x0, y0, x1, y1, x) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}
function tableInterp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length-1]) return ys[ys.length-1];
  for (let i=0;i<xs.length-1;i++) {
    if (x >= xs[i] && x <= xs[i+1]) return lerp(xs[i], ys[i], xs[i+1], ys[i+1], x);
  }
  return ys[ys.length-1];
}

function airProps(T) {
  const {T:Ts, rho, nu} = lookup.air;
  return { rho: tableInterp(Ts, rho, T), nu: tableInterp(Ts, nu, T) };
}
function waterProps(T) {
  const {T:Ts, rho, nu} = lookup.water;
  return { rho: tableInterp(Ts, rho, T), nu: tableInterp(Ts, nu, T) };
}
function alphaFromRe(Re) {
  const xs = lookup.alpha_of_Re.map(p=>p.Re);
  const ys = lookup.alpha_of_Re.map(p=>p.alpha);
  return tableInterp(xs, ys, Re);
}

function tc_mv_to_t(type, mv) {
  const m = lookup.tc[type];
  if (!m || !Number.isFinite(mv)) return NaN;
  if (type === 'K') {
    // 使用表格插值（mV→t）
    const Ts = m.T; // ℃
    const Es = m.E; // mV
    if (!Array.isArray(Ts) || !Array.isArray(Es) || Ts.length !== Es.length) return NaN;
    // 边界外返回NaN，避免误用
    if (mv < Es[0] || mv > Es[Es.length-1]) return NaN;
    // 在Es中找到区间，线性插值求温度
    for (let i=0; i<Es.length-1; i++) {
      const e0 = Es[i], e1 = Es[i+1];
      if (mv >= e0 && mv <= e1) {
        return lerp(e0, Ts[i], e1, Ts[i+1], mv);
      }
    }
    return Ts[Ts.length-1];
  }
  // 其它类型：保持线性近似
  if (typeof m.a === 'number' && typeof m.b === 'number') {
    return m.a * mv + m.b;
  }
  return NaN;
}
function rtd_R_to_t(type, R) {
  if (type === 'Pt100') {
    const m = lookup.rtd.Pt100;
    if (!m || !Array.isArray(m.T) || !Array.isArray(m.R)) return NaN;
    if (!Number.isFinite(R)) return NaN;
    const Rs = m.R, Ts = m.T;
    if (R < Rs[0] || R > Rs[Rs.length-1]) return NaN;
    for (let i=0;i<Rs.length-1;i++) {
      const r0 = Rs[i], r1 = Rs[i+1];
      if (R >= r0 && R <= r1) {
        return lerp(r0, Ts[i], r1, Ts[i+1], R);
      }
    }
    return Ts[Ts.length-1];
  }
  if (type === 'Cu50') {
    const m = lookup.rtd.Cu50;
    if (!m || !Array.isArray(m.T) || !Array.isArray(m.R)) return NaN;
    if (!Number.isFinite(R)) return NaN;
    const Rs = m.R, Ts = m.T;
    if (R < Rs[0] || R > Rs[Rs.length-1]) return NaN;
    for (let i=0;i<Rs.length-1;i++) {
      const r0 = Rs[i], r1 = Rs[i+1];
      if (R >= r0 && R <= r1) {
        return lerp(r0, Ts[i], r1, Ts[i+1], R);
      }
    }
    return Ts[Ts.length-1];
  }
  return NaN;
}
// 统计工具
function avg(xs) {
  const arr = xs.filter(x => Number.isFinite(x));
  if (arr.length === 0) return NaN;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}
function std_error_against_reference(readings, reference) {
  // σ = sqrt(sum((Xi - X)^2)/n), 指导书中 X 为标定值（标准水银温度计/标定流量计均值）
  const n = readings.length;
  if (n === 0 || !Number.isFinite(reference)) return NaN;
  const s = readings.reduce((acc, x) => acc + Math.pow(x - reference, 2), 0);
  return Math.sqrt(s / n);
}

// 温度：按指导书执行（5次均值；各仪表对标准温度计均值的σ）
function calcTemp(inputs) {
  const steps = [];
  function read5(prefix) {
    return [1,2,3,4,5].map(i => Number(inputs[`${prefix}_${i}`]));
  }
  const Tstds = read5('std_thermo_t');
  const Kmv = read5('k_mv');
  const Kt = read5('k_t');
  const Emv = read5('e_mv');
  const Et = read5('e_t');
  const Tmv = read5('t_mv');
  const Ttype = read5('t_t');
  const Pt100R = read5('pt100_r');
  const Pt100t = read5('pt100_t');
  const Cu50R = read5('cu50_r');
  const Cu50t = read5('cu50_t');
  const Bimetal = read5('bimetal_t');
  const PressureT = read5('pressure_t');

  const Tstd = avg(Tstds);
  steps.push(`标准水银温度计5次值平均: Tstd = (${Tstds.map(v=>v||'').join(' + ')})/5 = ${fmt.fixed(Tstd,2)} ℃`);

  function section(name, arr) {
    const a = avg(arr);
    const sigma = std_error_against_reference(arr.filter(Number.isFinite), Tstd);
    steps.push(`${name} 温度5次平均: ${fmt.fixed(a,2)} ℃；相对标准值的标准误差: σ = ${fmt.fixed(sigma,2)} ℃`);
    return { a, sigma };
  }
  // 测量平均值
  const KmvAvg = avg(Kmv);
  const EmvAvg = avg(Emv);
  const TmvAvg = avg(Tmv);
  const Pt100Ravg = avg(Pt100R);
  const Cu50Ravg = avg(Cu50R);
  if (Number.isFinite(KmvAvg)) steps.push(`K型 热电势测量平均值: ${fmt.fixed(KmvAvg,3)} mV`);
  if (Number.isFinite(EmvAvg)) steps.push(`E型 热电势测量平均值: ${fmt.fixed(EmvAvg,3)} mV`);
  if (Number.isFinite(TmvAvg)) steps.push(`T型 热电势测量平均值: ${fmt.fixed(TmvAvg,3)} mV`);
  if (Number.isFinite(Pt100Ravg)) steps.push(`Pt100 电阻测量平均值: ${fmt.fixed(Pt100Ravg,3)} Ω`);
  if (Number.isFinite(Cu50Ravg)) steps.push(`Cu50 电阻测量平均值: ${fmt.fixed(Cu50Ravg,3)} Ω`);
  const k = section('K型', Kt);
  const e = section('E型', Et);
  const t = section('T型', Ttype);
  const pt = section('Pt100', Pt100t);
  const cu = section('Cu50', Cu50t);
  const bm = section('双金属', Bimetal);
  const pr = section('压力式', PressureT);

  return { steps, final: {
    Tstd,
    KmvAvg, EmvAvg, TmvAvg, Pt100Ravg, Cu50Ravg,
    Kavg: k.a, Eavg: e.a, TtypeAvg: t.a, Pt100avg: pt.a, Cu50avg: cu.a, Bimetalavg: bm.a, Pressureavg: pr.a,
    Ksigma: k.sigma, Esigma: e.sigma, Ttypesigma: t.sigma, Pt100sigma: pt.sigma, Cu50sigma: cu.sigma, Bimetalsigma: bm.sigma, Pressuresigma: pr.sigma,
  }};
}

// 流量：参考（标定）为：气体用涡街；液体用涡轮。压差法与流速法按(1)(2)(3)
function calcFlow(inputs) {
  const steps = [];
  function read5(prefix) { return [1,2,3,4,5].map(i => Number(inputs[`${prefix}_${i}`])); }
  const medium = inputs.medium || 'gas';
  const ref = read5('ref_q'); // m3/h
  const Qref = avg(ref);
  steps.push(`参考流量计5次均值: Qref = (${ref.map(v=>v||'').join(' + ')})/5 = ${fmt.fixed(Qref,3)} m³/h`);

  // 压差节流
  const dptype = inputs.dp_type || 'orifice';
  const dpkpa = read5('dp_kpa');
  const rho = Number(inputs.rho);
  let Qdp_list = [];
  if (dptype === 'orifice') {
    const d = Number(inputs.d_orifice);
    const D = Number(inputs.D_orifice);
    const alpha = Number(inputs.alpha);
    const So = Math.PI * Math.pow(d,2) / 4;
    steps.push(`孔板（式1）: Q = α*·S0·√(2Δp/ρ), S0 = πd²/4 = ${fmt.fixed(So,6)} m²`);
    Qdp_list = dpkpa.map(kpa => {
      const dp = kpa * 1000; // kPa→Pa
      const Q = alpha * So * Math.sqrt(2*dp/rho); // m³/s
      return Q * 3600; // m³/h
    });
  } else {
    const d = Number(inputs.d_venturi);
    const D = Number(inputs.D_venturi);
    const So = Math.PI * Math.pow(d,2) / 4;
    const beta4 = Math.pow(d/D, 4);
    steps.push(`文丘里（式2）: Q = (πd²/4)·√(2Δp/(ρ(1-(d/D)^4)))`);
    Qdp_list = dpkpa.map(kpa => {
      const dp = kpa * 1000;
      const Q = So * Math.sqrt((2*dp) / (rho * (1 - beta4)));
      return Q * 3600; // m³/h
    });
  }
  const Qdp = avg(Qdp_list);
  const sigma_dp = std_error_against_reference(Qdp_list.filter(Number.isFinite), Qref);
  steps.push(`压差法5次换算流量均值: ${fmt.fixed(Qdp,3)} m³/h；相对标定的标准误差 σ = ${fmt.fixed(sigma_dp,3)} m³/h`);

  // 流速法（毕托）式(3)
  const pitot = read5('pitot_kpa');
  const D = Number(inputs.D_pitot);
  const rho_p = Number(inputs.rho_pitot);
  const area = Math.PI * Math.pow(D,2) / 4;
  const Qpitot_list = pitot.map(kpa => {
    const dp = kpa * 1000;
    const v = Math.sqrt((2*dp)/rho_p);
    return area * v * 3600; // m³/h
  });
  const Qpitot = avg(Qpitot_list);
  const sigma_pitot = std_error_against_reference(Qpitot_list.filter(Number.isFinite), Qref);
  steps.push(`毕托法5次换算流量均值: ${fmt.fixed(Qpitot,3)} m³/h；相对标定的标准误差 σ = ${fmt.fixed(sigma_pitot,3)} m³/h`);

  return { steps, final: { Qref, Qdp, sigma_dp, Qpitot, sigma_pitot } };
}

// 压力及流速：平均、最大相对误差、毕托流速
function calcPressure(inputs) {
  const steps = [];
  function read5(prefix) { return [1,2,3,4,5].map(i => Number(inputs[`${prefix}_${i}`])); }
  const pser = read5('p_series');
  const A = avg(pser);
  steps.push(`压力5次平均: A = (${pser.map(v=>v||'').join(' + ')})/5 = ${fmt.fixed(A,4)}`);
  const delta = Number(inputs.delta_class);
  const A0 = Number(inputs.range_A0);
  const deltaMax = Number.isFinite(delta) && Number.isFinite(A0) && Number.isFinite(A) && A !== 0
    ? (delta * A0 / A)
    : NaN;
  steps.push(`最大相对误差: δmax = δ·A0/A = ${delta}·${A0}/${fmt.fixed(A,4)} = ${fmt.fixed(deltaMax,3)} %`);

  const dps = read5('dp_speed');
  const rho = Number(inputs.rho_speed);
  const vs = dps.map(kpa => {
    const dp = kpa * 1000;
    return Math.sqrt((2*dp)/rho);
  });
  const vavg = avg(vs);
  steps.push(`流速（毕托）: v = √(2Δp/ρ)，5次均值 v = ${fmt.fixed(vavg,3)} m/s`);

  return { steps, final: { Pavg: A, deltaMax, vavg } };
}

// 绑定事件
function bindEvents() {
  $$('.tab').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
  ensureRow5();

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'calc-temp') {
      const form = $('#form-temp');
      const data = Object.fromEntries(new FormData(form));
      const { steps, final } = calcTemp(data);
      appendSteps($('[data-steps-for="temp"]'), steps);
      setFinal('temp.Tstd', `${fmt.fixed(final.Tstd, 2)}`);
      setFinal('temp.KmvAvg', `${fmt.fixed(final.KmvAvg,3)}`);
      setFinal('temp.Kavg', `${fmt.fixed(final.Kavg,2)}`);
      setFinal('temp.EmvAvg', `${fmt.fixed(final.EmvAvg,3)}`);
      setFinal('temp.Eavg', `${fmt.fixed(final.Eavg,2)}`);
      setFinal('temp.TmvAvg', `${fmt.fixed(final.TmvAvg,3)}`);
      setFinal('temp.TtypeAvg', `${fmt.fixed(final.TtypeAvg,2)}`);
      setFinal('temp.Pt100Ravg', `${fmt.fixed(final.Pt100Ravg,3)}`);
      setFinal('temp.Pt100avg', `${fmt.fixed(final.Pt100avg,2)}`);
      setFinal('temp.Cu50Ravg', `${fmt.fixed(final.Cu50Ravg,3)}`);
      setFinal('temp.Cu50avg', `${fmt.fixed(final.Cu50avg,2)}`);
      setFinal('temp.Bimetalavg', `${fmt.fixed(final.Bimetalavg,2)}`);
      setFinal('temp.Pressureavg', `${fmt.fixed(final.Pressureavg,2)}`);
      setFinal('temp.Ksigma', `${fmt.fixed(final.Ksigma,2)}`);
      setFinal('temp.Esigma', `${fmt.fixed(final.Esigma,2)}`);
      setFinal('temp.Ttypesigma', `${fmt.fixed(final.Ttypesigma,2)}`);
      setFinal('temp.Pt100sigma', `${fmt.fixed(final.Pt100sigma,2)}`);
      setFinal('temp.Cu50sigma', `${fmt.fixed(final.Cu50sigma,2)}`);
      setFinal('temp.Bimetalsigma', `${fmt.fixed(final.Bimetalsigma,2)}`);
      setFinal('temp.Pressuresigma', `${fmt.fixed(final.Pressuresigma,2)}`);
    }
    if (action === 'lookup-temp') {
      const form = $('#form-temp');
      let converted = 0;
      const parse = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) return NaN;
        const raw = (el.value || '').trim().replace(',', '.');
        const v = parseFloat(raw);
        return Number.isFinite(v) ? v : NaN;
      };
      for (let i=1;i<=5;i++) {
        const k_mv = parse(`k_mv_${i}`);
        const e_mv = parse(`e_mv_${i}`);
        const t_mv = parse(`t_mv_${i}`);
        const pt_r = parse(`pt100_r_${i}`);
        const cu_r = parse(`cu50_r_${i}`);
        if (Number.isFinite(k_mv)) { form.querySelector(`[name="k_t_${i}"]`).value = fmt.fixed(tc_mv_to_t('K', k_mv), 2); converted++; }
        if (Number.isFinite(e_mv)) { form.querySelector(`[name="e_t_${i}"]`).value = fmt.fixed(tc_mv_to_t('E', e_mv), 2); converted++; }
        if (Number.isFinite(t_mv)) { form.querySelector(`[name="t_t_${i}"]`).value = fmt.fixed(tc_mv_to_t('T', t_mv), 2); converted++; }
        if (Number.isFinite(pt_r)) { form.querySelector(`[name="pt100_t_${i}"]`).value = fmt.fixed(rtd_R_to_t('Pt100', pt_r), 2); converted++; }
        if (Number.isFinite(cu_r)) { form.querySelector(`[name="cu50_t_${i}"]`).value = fmt.fixed(rtd_R_to_t('Cu50', cu_r), 2); converted++; }
      }
      if (converted === 0) {
        alert('未检测到可转换的数值，请在 mV/Ω 输入框中输入有效数字。支持小数点或逗号。');
      }
    }
    if (action === 'calc-flow') {
      const form = $('#form-flow');
      const data = Object.fromEntries(new FormData(form));
      const { steps, final } = calcFlow(data);
      appendSteps($('[data-steps-for="flow"]'), steps);
      setFinal('flow.Qref', `${fmt.fixed(final.Qref, 3)}`);
      setFinal('flow.Qdp', `${fmt.fixed(final.Qdp, 3)}`);
      setFinal('flow.sigma_dp', `${fmt.fixed(final.sigma_dp, 3)}`);
      setFinal('flow.Qpitot', `${fmt.fixed(final.Qpitot, 3)}`);
      setFinal('flow.sigma_pitot', `${fmt.fixed(final.sigma_pitot, 3)}`);
    }
    if (action === 'props-re-alpha') {
      const form = $('#form-flow');
      const data = Object.fromEntries(new FormData(form));
      const medium = data.medium || 'gas';
      const T = Number(data.T_medium);
      const D = Number(data.D_orifice || data.D_venturi || data.D_pitot);
      const ref = [1,2,3,4,5].map(i => Number(data[`ref_q_${i}`]));
      const Qref = avg(ref) / 3600; // m3/s
      // 取截面积：优先管道直径
      const area = Number.isFinite(D) ? Math.PI * D*D / 4 : NaN;
      const props = medium === 'gas' ? airProps(T) : waterProps(T);
      const um = Number.isFinite(area) && Number.isFinite(Qref) ? Qref / area : NaN;
      const Re = Number.isFinite(um) ? um * (D) / props.nu : NaN;
      const alpha = alphaFromRe(Re);

      const steps = [];
      steps.push(`物性查表: ρ = ${fmt.fixed(props.rho, 4)} kg/m³, ν = ${props.nu.toExponential(2)} m²/s @ ${fmt.fixed(T,1)} ℃`);
      steps.push(`平均流速: um = Q/(πD²/4) = ${fmt.fixed(um,3)} m/s`);
      steps.push(`雷诺数: Re = um·D/ν = ${fmt.fixed(Re,0)}`);
      steps.push(`孔板流量系数: α* = ${fmt.fixed(alpha,3)}（按Re插值）`);
      appendSteps($('[data-steps-for="flow"]'), steps);
      // 写入表单提示用户
      const alphaEl = form.querySelector('[name="alpha"]');
      if (alphaEl) alphaEl.value = fmt.fixed(alpha, 4);
      const rhoEl = form.querySelector('[name="rho"]');
      if (rhoEl) rhoEl.value = fmt.fixed(props.rho, 3);
      const rhoPitot = form.querySelector('[name="rho_pitot"]');
      if (rhoPitot) rhoPitot.value = fmt.fixed(props.rho, 3);
    }
    if (action === 'calc-pressure') {
      const form = $('#form-pressure');
      const data = Object.fromEntries(new FormData(form));
      const { steps, final } = calcPressure(data);
      appendSteps($('[data-steps-for="pressure"]'), steps);
      setFinal('pressure.Pavg', `${fmt.fixed(final.Pavg, 4)}`);
      setFinal('pressure.deltaMax', `${fmt.fixed(final.deltaMax, 3)}`);
      setFinal('pressure.vavg', `${fmt.fixed(final.vavg, 3)}`);
    }
  });

  // 导入（简易CSV，仅示意）
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    // 预期格式：键,值 每行一对
    const map = Object.create(null);
    text.split(/\r?\n/).forEach(line => {
      const [k, v] = line.split(',');
      if (k && v !== undefined) map[k.trim()] = v.trim();
    });
    // 将键匹配到当前可见表单
    const activePanel = $('.panel.active');
    if (!activePanel) return;
    $$('input,select', activePanel).forEach(el => {
      const name = el.getAttribute('name');
      if (name && map[name] !== undefined) el.value = map[name];
    });
  });

  // 导出结果（当前面板）
  $('#export-results').addEventListener('click', () => {
    const activePanel = $('.panel.active');
    if (!activePanel) return;
    const stepsEl = $('.steps', activePanel);
    const finalEls = $$('[data-final]', activePanel);
    const lines = [];
    lines.push('类型,内容');
    $$('li', stepsEl).forEach(li => lines.push(`步骤,${li.textContent?.replace(/,/g, '，')}`));
    finalEls.forEach(el => {
      const key = el.closest('.final-row')?.querySelector('.key')?.textContent || '结果';
      lines.push(`${key.replace(/,/g,'，')},${el.textContent}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '实验结果.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // 重置
  $('#reset-all').addEventListener('click', () => {
    $$('form').forEach(f => f.reset());
    $$('.steps').forEach(ul => ul.innerHTML = '');
    $$('[data-final]').forEach(el => el.textContent = '');
  });
}

document.addEventListener('DOMContentLoaded', bindEvents);


