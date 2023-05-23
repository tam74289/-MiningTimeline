const colors = [
  '#2f77eb',
  '#fe51af',
  '#ffa600',
  '#9FE2BF',
  '#40E0D0',
  '#6495ED',
  '#CCCCFF',
  '#DFFF00',
  '#FFBF00',
  '#FF7F50',
  '#DE3163',
];

const getCache = (name) => {
  if (localStorage.getItem(name)) {
    return JSON.parse(localStorage.getItem(name));
  }
  return null;
}

const setCache = (name, data) => {
  localStorage.setItem(name, JSON.stringify(data));
};

const setServerCache = async (filepath, data) => {
  const response = await fetch('server/writeFileSync.php', {
    method: 'POST',
    body: JSON.stringify({
      filepath,
      data,
    }),
  });
  // console.log('setServerCache response', response);
  return response.json();
};

// setServerCache('test.php', `
// <?php echo "Hello world!"; ?>
// `);
// setServerCache('taras/2023-05/test.json', { test: 'ok' });

const getServerCache = async (filepath) => {
  const response = await fetch(`server/readFileSync.php?filepath=${filepath}`, {
    method: 'POST',
    body: JSON.stringify({
      filepath,
    }),
  });
  // console.log('getServerCache response', response);
  return response.json();
};

const setAssetCache = async (assetId, templateId) => {
  const response = await fetch('server/writeAsset.php', {
    method: 'POST',
    body: JSON.stringify({
      assetId,
      templateId,
    }),
  });
  // console.log('setServerCache response', response);
  return response.json();
};

// setServerCache('test.php', `
// <?php echo "Hello world!"; ?>
// `);
// setServerCache('taras/2023-05/test.json', { test: 'ok' });

const getAssetsCache = async () => {
  const response = await fetch(`server/readAssets.php`, {
    method: 'POST',
    body: JSON.stringify({
    }),
  });
  // console.log('getServerCache response', response);
  return response.json();
};

const getTLMPrice = async () => {
  const response = await fetch('https://api.binance.com/api/v3/avgPrice?symbol=TLMUSDT');
  // console.log('response', response);

  return await response.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function myFetch(endpoints, callConfig) {
  callConfig = {
    endpointIndex: 0,
    retryTimes: 0,
    retrySleep: 2000, // 2s
    retryCount: 0,
    ...callConfig,
  };
  const endpoint = endpoints[callConfig.endpointIndex];
  // console.log('try endpoint', endpoint);
  if (endpoint) {
    try {
      const fetchConfig = {
        method: endpoint.method || 'GET',
      };
      if (endpoint.method === 'POST') {
        fetchConfig.body = JSON.stringify(endpoint.body);
      }
      const response = await fetch(endpoint.url, fetchConfig);
      // console.log('myFetch response', response);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // console.log('myFetch error', error);
    }

    callConfig.endpointIndex++;
    return await myFetch(endpoints, callConfig);
  } else {
    callConfig.retryCount++;
    if (callConfig.retryTimes >= callConfig.retryCount) {
      // console.log('Try again', callConfig.retryCount, 'of', callConfig.retryTimes)
      callConfig.endpointIndex = 0;
      // console.log('sleep 2s');
      await sleep(callConfig.retrySleep);
      // console.log('wake');
      return await myFetch(endpoints, callConfig);
    }
  }
  return await Promise.reject('myFetch error! Tried all endpoints.');
}

async function getTxUser(config, retryTimes = 0) {
  config = {
    username: '',
    ...config,
  };

  const apis = [
    'https://wax.cryptolions.io',
    'https://api.wax.alohaeos.com',
    'https://wax.eosrio.io',
    'https://wax.dapplica.io',
  ];

  const endpoints = apis.map(api => {
    return {
      url: `${api}/v2/history/get_creator?account=${config.username}`,
      // ... method, body
    };
  });
  
  // const endpoints = [
  //   { url: `https://wax.eosrio.io/v2/history/get_creator?account=${config.username}` },
  //   { url: `https://wax.dapplica.io/v2/history/get_creator?account=${config.username}` },
  //   { url: `https://api.wax.alohaeos.com/v2/history/get_creator?account=${config.username}` },
  // ];

  try {
    return await myFetch(endpoints, { retryTimes });
  } catch (error) {
    showDOMError(`Wax address <span class="text-danger">${config.username}</span> failed to load.<br>If the address is valid it could be a temporary server issue.`);
  }
}

async function getTxList(config, retryTimes = 1) {
  config = {
    username: '',
    date: new Date().toISOString(),
    ...config,
  };

  const key = `${config.username}/${dayjs(config.date).format('YYYY-MM')}/${dayjs(config.date).format('DD')}`;
  const cachedDay = await getServerCache(key);

  if (cachedDay && !dayjs(config.date).isToday()) {
    return { cached: true, items: cachedDay };
  } else {

    // PREPARE PARAMS
    const after = dayjs(config.date).startOf('day').toISOString();
    const before = dayjs(config.date).endOf('day').toISOString();

    const endpoints = [
      { url: `https://api.wax.alohaeos.com/v2/history/get_actions?account=${config.username}&filter=*%3Amine&skip=0&limit=100&sort=asc&after=${after}&before=${before}` },
      { url: `https://wax.eosrio.io/v2/history/get_actions?account=${config.username}&filter=*%3Amine&skip=0&limit=100&sort=asc&after=${after}&before=${before}` },
    ];

    try {
      return await myFetch(endpoints, { retryTimes });
    } catch (error) {
      console.log('getTxList', error);
      showDOMError(`Transactions list for wax address <span class="text-danger">${config.username}</span> failed to load.<br>If the address is valid it could be a temporary server issue.`);
    }
  }
}

async function getTxInfo(config, retryTimes = 0) {
  config = {
    id: '',
    ...config,
  };

  const endpoints = [
    {
      url: `https://wax.greymass.com/v1/history/get_transaction`,
      method: 'POST',
      body:  {
        id: config.id,
        block_num_hint: 0,
      },
    },
    {
      url: `https://api.waxsweden.org/v1/history/get_transaction`,
      method: 'POST',
      body:  {
        id: config.id,
        block_num_hint: 0,
      },
    },
  ];

  try {
    return await myFetch(endpoints, { retryTimes });
  } catch (error) {
    console.log('getTx', error);
    showDOMError(`Transaction<br>ID:&nbsp;<span class="text-danger">${config.id}</span><br>failed to load.<br>It could be a temporary server issue.`);
  }
}

const buildChart = (datasets) => {

    let chartStatus = Chart.getChart("line-chart"); // <canvas> id
    if (chartStatus != undefined) {
      chartStatus.destroy();
    }

    const chartDomEl = document
      .getElementById("line-chart")
      .getContext("2d");

      const chart = new Chart(chartDomEl, {
      type: "line",
      options: {
        spanGaps: true,
        scales: {
          x: {
            type: "time",
            parsing: false,
            time: {
              tooltipFormat: 'dd MMM yyyy, HH:mm:ss',
              displayFormats: {
                millisecond: 'HH:mm',
                second: 'HH:mm',
                minute: 'HH:mm',
                hour: 'HH:mm',
                day: 'HH:mm',
                // week: 'HH:mm',
                // month: 'HH:mm',
                // quarter: 'HH:mm',
                // year: 'HH:mm',
              },
            },
            // min: dayjs(-1, 'day'),
            // max: dayjs(0, 'day'),
            grid: {
              color: 'rgba(255,255,255,0.2)',
            },
            ticks: { color: '#fff' },
          },
          y: {
            grid: {
              color: 'rgba(255,255,255,0.2)',
            },
            ticks: { color: '#fff' },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff',
              boxWidth: 20,
              boxHeight: 20,
              font: {
                size: 16,
                family: "'Orbitron', 'sans-serif'",
              }
            },
          },
          tooltip: {
            callbacks: {
              // afterTitle: (tooltipItems) => {
              //   console.log('items', tooltipItems);
              //   return `afterTitle`;
              // },
              // afterLabel: (tooltipItems) => {
              //   console.log('items', tooltipItems);
              //   return `afterLabel`;
              // },
              // beforeBody: (tooltipItems) => {
              //   console.log('items', tooltipItems);
              //   return `beforeBody`;
              // },
              // afterBody: (tooltipItems) => {
              //   console.log('items', tooltipItems);
              //   return `afterBody`;
              // },
              label: (item) => {
                // console.log('label item', item);
                return item && ` ${item.dataset.label}: ${round3(+item.raw.y)}`;
              },
              labelTextColor: function(context) {
                return 'cyan';
              },
              beforeFooter: (tooltipItems) => {
                // console.log('beforeFooter items', tooltipItems);
                const serie = tooltipItems[0];
                if (serie && serie.raw && serie.raw.land) {
                  return `★ ${serie.raw.land}`;
                }
                return `★ [!] Land unknown`;
              },
              footer: (tooltipItems) => {
                // console.log('footer items', tooltipItems);
                const serie = tooltipItems[0];
                if (serie && serie.raw && Array.isArray(serie.raw.tools) && serie.raw.tools.length) {
                  return serie.raw.tools.map((v, i) => `↳ #${i + 1} ${v}`).join('\n');
                }
                return `↳ [!] Tools unknown`;
              },
            },
            // enabled: false,
            // position: 'nearest',
            // external: externalTooltipHandler,
          }
        },
      },
      data: { datasets },
    });
}

const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.style.background = 'rgba(0, 0, 0, 0.7)';
    tooltipEl.style.borderRadius = '3px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transform = 'translate(-50%, 0)';
    tooltipEl.style.transition = 'all .1s ease';

    const table = document.createElement('table');
    table.style.margin = '0px';

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

const externalTooltipHandler = (context) => {
  // Tooltip Element
  const {chart, tooltip} = context;
  const tooltipEl = getOrCreateTooltip(chart);

  // Hide if no tooltip
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Set Text
  if (tooltip.body) {
    const titleLines = tooltip.title || [];
    const bodyLines = tooltip.body.map(b => b.lines);

    const tableHead = document.createElement('thead');

    titleLines.forEach(title => {
      const tr = document.createElement('tr');
      tr.style.borderWidth = 0;

      const th = document.createElement('th');
      th.classList.add('number');
      th.classList.add('small');
      th.style.borderWidth = 0;
      const text = document.createTextNode(title);

      th.appendChild(text);
      tr.appendChild(th);
      tableHead.appendChild(tr);
    });

    const tableBody = document.createElement('tbody');
    bodyLines.forEach((body, i) => {
      const colors = tooltip.labelColors[i];

      const span = document.createElement('span');
      span.style.background = colors.backgroundColor;
      span.style.borderColor = colors.borderColor;
      span.style.borderWidth = '2px';
      span.style.marginRight = '10px';
      span.style.height = '10px';
      span.style.width = '10px';
      span.style.display = 'inline-block';

      const tr = document.createElement('tr');
      tr.style.backgroundColor = 'inherit';
      tr.style.borderWidth = 0;

      const td = document.createElement('td');
      td.style.borderWidth = 0;

      // console.log('body', body);
      // const text = document.createHTMLNode(`${serie}: ${serieValue}`);

      const parts = body[0].split(':');
      const serie = parts[0]
      const serieValue = `<span class="number">${round3(+parts[1])}</span>`;
      const text = document.createElement('span');
      text.innerHTML = `${serie}: ${serieValue}`;

      td.appendChild(span);
      td.appendChild(text);
      tr.appendChild(td);
      tableBody.appendChild(tr);
    });

    const tableRoot = tooltipEl.querySelector('table');

    // Remove old children
    while (tableRoot.firstChild) {
      tableRoot.firstChild.remove();
    }

    // Add new children
    tableRoot.appendChild(tableHead);
    tableRoot.appendChild(tableBody);
  }

  const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;

  // Display, position, and set styles for font
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = positionX + tooltip.caretX + 'px';
  tooltipEl.style.top = positionY + tooltip.caretY + 'px';
  tooltipEl.style.font = tooltip.options.bodyFont.string;
  tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
};

const showDOMError = (message = 'Server error. Retry later.') => {
  hideDOMProgress();
  removeLast7DaysLoading();
  document.querySelector('#error').classList.remove('hidden');
  document.querySelector('#errorMessage').innerHTML = message;
  throw new Error(message);
}

window.hideDOMError = () => {
  document.querySelector('#error').classList.add('hidden');
}

const showDOMProgress = () => {
  document.querySelector('#progress').classList.remove('hidden');
}

const hideDOMProgress = () => {
  document.querySelector('#progress').classList.add('hidden');
}

const updateDOMProgress = (progressInfoLabel = '') => {
  document.querySelector('#progress').innerHTML = `
    <span>${progressInfoLabel}</span>
    ${
      Math.round(window.progress * 100) / 100 + '%'
    }
  `;
}

const updateLast7DaysProgress = (progressInfoLabel = '') => {
  document.querySelector('#bar-chart-progress').innerHTML = `
    <span>${progressInfoLabel}</span>
    ${
      Math.round(window.last7DaysProgress * 100) / 100 + '%'
    }
  `;
}

const getDatasets = async(fetchDate, afterTxFetchCallback) => {

  const users = getUsers();

  let datasets = [];
  const stats = [];
  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const username = users[userIndex].username;

    const label = users[userIndex].label;
    const userStats = {
      label: label || username,
      username: username,
      reward: 0,
      count: 0,
      avgGain: 0,
      minGain: Infinity,
      maxGain: -Infinity,
      avgDiffTime: 0,
      minDiffTime: 0,
      maxDiffTime: 0,
    };
    const data = await getTxList({
      username,
      date: fetchDate,
    });

    if (data) {
      // console.log("data", data);
      //console.log("list", data.actions);

      const dataset = {
        label: label || username,
        data: [],
        borderColor: colors[userIndex % colors.length],
        backgroundColor: colors[userIndex % colors.length],
      };

      let prevDatetime = null;

      let firstDatetime = dayjs(fetchDate).startOf('day').toDate().getTime();
      let firstDatetimeDiff = 0;
      // now or end of day if in past
      let lastDatetime = Math.min(dayjs(fetchDate).endOf('day').toDate().getTime(), new Date().getTime());

      let items = data.items || []; // CACHED ITEMS

      if (!data.cached) {
        // console.log(fetchDate.toLocaleDateString(), label, ':::REMOTE:::', 'actions', data.actions.length);
        // FETCH TX ONE BY ONE
        if (Array.isArray(data.actions)) {
          for (let i = 0; i < data.actions.length; i++) {
            const item = data.actions[i];
            if (item.act.name === "mine") {
              const id = item.trx_id;
              const timestamp = dayjs(item.timestamp).toDate().getTime() - dayjs().toDate().getTimezoneOffset() * 60 * 1000;

              let reward, land_id, bag_items;

              const cachedItem = window.transactionsCacheMap[id];
              if (cachedItem) {
                // READ CACHED TX
                reward = cachedItem[0];
                land_id = cachedItem[1];
                bag_items = cachedItem[2];
              } else {
                // DOWNLOAD TX
                const tx = await getTxInfo({ id });
                const trace = tx.traces.find((t) => t.receiver === "notify.world");
                if (trace && trace.act && trace.act.data) {
                  if (trace.act.data.bounty && typeof trace.act.data.bounty === 'string' && trace.act.data.bounty.indexOf(' TLM') !== -1) {
                    reward = +trace.act.data.bounty.replace(' TLM', '');
                  }
                  land_id = trace.act.data.land_id;
                  bag_items = trace.act.data.bag_items;
                }

                // CACHE ONLY TODAY
                if (dayjs(fetchDate).isToday()) {
                  const dateKey = dayjs(fetchDate).endOf('day').toString();
                  let cachedDay = window.transactionsCache.find(tx => {
                    return dayjs(tx.date).endOf('day').toString() === dateKey;
                  });
                  if (!cachedDay) {
                    cachedDay = {
                      date: dateKey,
                      map: {},
                    };
                    window.transactionsCache.push(cachedDay);
                  }
                  // ADD TX ITEM IN CACHE
                  cachedDay.map[id] = [reward, land_id, bag_items];
                  // SAVE CACHE
                  setCache('transactionsCache', window.transactionsCache);
                }
              }

              if (typeof afterTxFetchCallback === 'function') {
                afterTxFetchCallback(userIndex, users, i, data.actions);
              }

              // REMOTE ITEMS
              items.push([Math.floor(timestamp/1000), reward, land_id, bag_items]);
            }
          }

          // SAVE SERVER CACHE
          const isInPast = dayjs(fetchDate).startOf('day').toDate() < dayjs().startOf('day').toDate();
          if (isInPast) {
            const key = `${username}/${dayjs(fetchDate).format('YYYY-MM')}/${dayjs(fetchDate).format('DD')}`;
            setServerCache(key, items);
            // console.log('::: SAVED IN SERVER CACHE :::', fetchDate, username);
          } else {
            // console.log('TODAY OR FUTURE... DONT SAVE!');
          }
        }
      } else {
        // console.log(fetchDate.toLocaleDateString(), label, ':::CACHED:::', 'items', items.length);
      }

      // PROCESS DATA

      dataset.data = [];
      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const v = items[itemIndex];

        const timestamp = dayjs(v[0] * 1000).toDate().getTime();
        if (prevDatetime) {
          const diffTime = timestamp - prevDatetime;
          // console.log('diffTime', diffTime);
          
          // MIN DIFF TIME
          if (!userStats.minDiffTime) {
            userStats.minDiffTime = diffTime;
          } else {
            userStats.minDiffTime = Math.min(diffTime, userStats.minDiffTime);
          }
          // MAX DIFF TIME
          if (!userStats.maxDiffTime) {
            userStats.maxDiffTime = diffTime;
          } else {
            userStats.maxDiffTime = Math.max(diffTime, userStats.maxDiffTime);
          }
          // console.log('userStats.minDiffTime', userStats.minDiffTime);
        } else {
          firstDatetimeDiff = timestamp - firstDatetime;
        }
        prevDatetime = timestamp;
        const reward = v[1];
        userStats.reward += reward;
        userStats.count += 1;
        userStats.minGain = Math.min(userStats.minGain, reward);
        userStats.maxGain = Math.max(userStats.maxGain, reward);

        // LAND AND TOOLS
        let landLabel, toolsLabels = [];

        // FETCH LAND
        if (v[2]) {
          landLabel = await getMiningAsset(v[2], 'land');
          // console.log('Land is', landLabel);
        }
        
        // FETCH TOOLS
        if (Array.isArray(v[3])) {
          for (let jj = 0; jj < v[3].length; jj++) {
            const toolLabel = await getMiningAsset(v[3][jj], 'tool');
            // console.log('Tool', jj, toolLabel);
            toolsLabels.push(toolLabel);
          }
        }

        dataset.data.push({
          x: timestamp,
          y: reward,
          land: landLabel,
          tools: toolsLabels,
        });
      }

      const lastDatetimeDiff = prevDatetime ? lastDatetime - prevDatetime : 0;
      userStats.maxDiffTime = Math.max(userStats.maxDiffTime, firstDatetimeDiff, lastDatetimeDiff);
      userStats.avgGain = userStats.count ? userStats.reward / userStats.count : 0;
      // userStats.avgDiffTime =
      
      stats.push(userStats);
      datasets.push(dataset);
    }
  }
  return { datasets, stats };
}

const round = (number) => {
  return (Math.round(number * 100) / 100).toLocaleString();
}

const round3 = (number) => {
  return (Math.round(number * 1000) / 1000).toLocaleString();
}

const round4 = (number) => {
  return (Math.round(number * 10000) / 10000).toLocaleString();
}

const resetStats = () => {
  document.querySelector('#stats').innerHTML = '';
};

const buildStats = (stats) => {
  const statsEl = document.querySelector('#stats');

  const totalReward = stats.reduce((acc, val) => {
    acc += val.reward;
    return acc;
  }, 0);

  let statsHTML = `
    <div class="col col-12 mb-4">
      <div class="card" style="min-height: 0;">
        <div class="card-body">
          <h5 class="card-title mb-0">Total daily rewards:<br><span class=""><span class="text-success number">+${round(totalReward * window.price)}</span> USDT</span> ≈ <span class=""><span class="text-warning number">${round3(totalReward)}</span> TLM</span></h5>
        </div>
      </div>
    </div>
  `;

//   <div>
//   <span class="stats-value"><span class="number">${round(stat.avgGain)}</span></span> <span class="stats-info">avg</span>
// </div>
// <div>
//   <span class="stats-value"><span class="number">${msToHuman(stat.minDiffTime)}</span></span> <span class="stats-info">fastest</span>
// </div>
// <div>
//   <span class="stats-value"><span class="number">${msToHuman(stat.maxDiffTime)}</span></span> <span class="stats-info">slowest</span>
// </div>

  stats.forEach(stat => {
    statsHTML += `
      <div class="col col-12 col-md-4 mb-4">
        <div class="card">
          <div class="card-body">
              <h5 class="card-title">
                ${stat.label}:<br>
                <span><span class="text-success number">+${round(stat.reward * window.price)}</span> USDT</span>
                <span class="text-white-50 float-right"><span class="number">${round(stat.reward * 100 / (totalReward || 1))}</span>%</span>
              </h5>
              <div class="row align-items-center">
                <div class="col">
                  <span class="stats-value text-warning"><span class="number">${round3(stat.reward)}</span></span> <span class="stats-info">TLM</span>
                </div>
                <div class="col col-auto text-right">
                  <span class="stats-value"><span class="number">${stat.count}</span></span> <i class="icon-click"></i>
                </div>
              </div>
          </div>
        </div>
        <table class="table ${stat.username === 'XXX' ? 'hidden' : ''}">
          <thead class="small">
            <th></th>
            <th>TLM</th>
            <th>Time Range</th>
          </thead>
          <tbody>
            <tr>
              <td class="small">AVG</td>
              <td><span class="number text-primary">${round3(stat.avgGain)}</span></td>
              <td></td>
            </tr>
            <tr>
              <td class="small">BEST</td>
              <td><span class="number text-warning">${round3(stat.maxGain)}</span></td>
              <td><span class="number small">${msToHuman(stat.minDiffTime)}</span></td>
            </tr>
            <tr>
              <td class="small">WORST</td>
              <td><span class="number text-danger">${round3(stat.minGain)}</span></td>
              <td><span class="number small">${msToHuman(stat.maxDiffTime)}</span></td>
            </tr>
          </tbody>
        </table>


      </div>
    `;
  });

  statsEl.innerHTML = statsHTML;
}

const msToHuman = (duration) => {
  const portions = [];

  const msInHour = 1000 * 60 * 60;
  const hours = Math.trunc(duration / msInHour);
  if (hours > 0) {
    portions.push(hours + 'h');
    duration = duration - (hours * msInHour);
  }

  const msInMinute = 1000 * 60;
  const minutes = Math.trunc(duration / msInMinute);
  if (minutes > 0) {
    portions.push(minutes + 'm');
    duration = duration - (minutes * msInMinute);
  }

  const seconds = Math.trunc(duration / 1000);
  if (seconds > 0) {
    portions.push(seconds + 's');
  }

  return portions.join(' ');
}

const getUsers = () => {
  const usersTxt = document.querySelector('#users').value;
  return usersTxt.split('\n').filter(v => !!v).map(v => v.trim().replace(/\s+/g, ' ').split(' ')).map(u => { return { username: u[0], label: u[1] } });
};

const initTransactionsCache = () => {
  // { date: Date, map: { txId: [ reward, landId, toolsIds[] ] } }[]
  window.transactionsCache = getCache('transactionsCache') || [];
  window.transactionsCache = window.transactionsCache.filter(tx => {
    const day = dayjs(tx.date);
    return day.isToday() || day.isYesterday();
  });
  window.transactionsCacheMap = window.transactionsCache.reduce((acc, tx) => {
    acc = { ...acc, ...tx.map };
    return acc;
  }, {});
};

window.update = async () => {

  initTransactionsCache();

  setForm();
  
  resetStats();
  buildChart([]);

  resetLast7DaysStats();
  buildBarChart({
    labels: [],
    datasets: [],
  });

  window.progress = 0;

  showDOMProgress();
  updateDOMProgress();

  // const dateStr = document.querySelector('#date').value || dayjs().toDate();
  // const inputDate = dayjs(dateStr).endOf('day');
  // window.date = dayjs(inputDate).toDate();

  // const users = []; //'XXX', 'XXX', 'XXX.wam'];
  const users = getUsers();

  for (let i = 0; i < users.length; i++) {
    const username = users[i].username;
    const validUsers = getCache('validUsersMap') || {};
    if (!validUsers[username]) {
      await getTxUser({ username });
      // if passed, set valid user
      validUsers[username] = 1;
      setCache('validUsersMap', validUsers);
    }
  }

  const data = await getDatasets(window.date, (userIndex, users, txIndex, txs) => {
    const usersCount = users.length;
    const txsCount = txs.length;
    window.progress = (userIndex / usersCount * 100) + (txIndex + 1) * (100 / usersCount / txsCount);
    updateDOMProgress(`User ${userIndex + 1}/${usersCount}, Tx ${txIndex + 1}/${txsCount}`);
  });

  if (data) {
    updateDate();
    // console.log('stats', stats);
    // console.log('datasets', datasets);
    buildChart(data.datasets);
    buildStats(data.stats);
    await sleep(500);
    hideDOMProgress();
  }

  if (!window.loadingLast7Days) {
    await loadLast7Days();
  }
}

const updatePrice = async () => {
  const priceObj = await getTLMPrice();
  if (priceObj) {
    window.price = priceObj.price;
    document.querySelector('#price').textContent = round4(price);
  }
}

const updateDate = () => {
  if (window.date) {
    const dateStr = window.date.toISOString().slice(0, 10);
    document.querySelector('#date').value = dateStr;
    const statsDateEl = document.querySelector('#stats-date');
    let pre = '';
    if (dayjs(window.date).isToday()) {
      pre = 'Today, ';
    }
    statsDateEl.textContent = pre + dayjs(window.date).format('D MMM YYYY');
  }
}

window.addDay = (delta) => {
  const dateStr = document.querySelector('#date').value || dayjs();
  // console.log('before', window.date);
  window.date = dayjs(dateStr).add(delta, 'days').endOf('day').toDate();
  // console.log('after', window.date);
  updateDate();
  window.update();
};

const setForm = () => {
  setCache('form', { users: document.querySelector('#users').value, date: document.querySelector('#date').value });
};

window.share = () => {

  const users = getUsers();

  const myUrlWithParams = new URL(`${location.origin}${location.pathname}`);
  myUrlWithParams.searchParams.append(
    'ids',
    users.map(v => {
      const withLabel = v.label ? `@${v.label}` : '';
      return `${v.username}${withLabel}`;
    }).join(',')
  );
  myUrlWithParams.searchParams.append("date", dayjs(window.date).format('YYYY-MM-DD'));

  const shareUrl = decodeURIComponent(myUrlWithParams.href);
  console.log('shareUrl', shareUrl);

  navigator.clipboard.writeText(shareUrl);
};

const loadForm = () => {

  window.date = dayjs().endOf('day').toDate();

  const form = getCache('form') || {};
  const params = new URLSearchParams(window.location.search);
  
  const usernamesStr = params.get('ids');
  if (usernamesStr) {
    const usernames = usernamesStr.split(',')
      .filter(v => !!v) // check for empty commas
      .map(v => v.replace('@', ' ')) // check for labels
      .join('\n');
    document.querySelector('#users').value = usernames;
  } else {
    if (form.users) {
      document.querySelector('#users').value = form.users;
    }
  }

  const dateStr = params.get('date');
  if (dateStr) {
    var timestamp = Date.parse(dateStr);
    if (isNaN(timestamp) == false) {
      window.date = dayjs(timestamp).endOf('day').toDate();
    }
  } else {
    if (form.date) {
      window.date = dayjs(form.date).endOf('day').toDate();
    }
  }
 
  updateDate();
};

window.cumulativeStats = [];
window.cumulativeStatslabels = [];
window.lastDaysCount = 7;

const setLast7DaysLoading = () => {
  window.loadingLast7Days = true;
  document.querySelector('#bar-chart-container').classList.add('loading');
};

const removeLast7DaysLoading = () => {
  window.loadingLast7Days = false;
  document.querySelector('#bar-chart-container').classList.remove('loading');
};

const loadLast7Days = async () => {
  window.cumulativeStats = [];
  window.cumulativeStatslabels = [];

  setLast7DaysLoading();

  window.last7DaysProgress = 0;
  updateLast7DaysProgress();

  const firstDate = dayjs().add(-window.lastDaysCount, 'days');
  const daysCount = window.lastDaysCount;
  
  for (let dayIndex = 0; dayIndex < daysCount; dayIndex++) {
    const date = dayjs(firstDate).add(dayIndex, 'days').toDate();
    window.cumulativeStatslabels.push(dayjs(date).format('ddd DD/MM'));
    const data = await getDatasets(date, (userIndex, users, txIndex, txs) => {
      const usersCount = users.length;
      const txsCount = txs.length;

      window.last7DaysProgress =  (
        dayIndex / daysCount * 100
      ) + (
        (userIndex / usersCount) * (100 / daysCount / usersCount)
      ) + (
        (txIndex + 1) * (100 / daysCount / usersCount / txsCount)
      );

      updateLast7DaysProgress(`Day ${dayIndex + 1}/${daysCount}, User ${userIndex + 1}/${usersCount}, Tx ${txIndex + 1}/${txsCount}`);
    });
    // console.log('loadLast7Days', date, 'datasets', data, data.stats);
    if (data) {
      data.stats.forEach((stat, index) => {
        if (!window.cumulativeStats[dayIndex]) {
          window.cumulativeStats[dayIndex] = [];
        }
        window.cumulativeStats[dayIndex].push({
          date,
          reward: stat.reward,
          clicks: stat.count,
        });
      });
    }
  }

  await processLast7Days();
  buildLast7DaysStats();

  await sleep(500);
  removeLast7DaysLoading();

};

const allSwitches = document.querySelectorAll('.switch-option');

window.onCumulativeStatsKeyChange = (element, key) => {
  if (!element.classList.contains('active')) {
    allSwitches.forEach(el => {
      el.classList.remove('active');
    });
    element.classList.add('active');
    processLast7Days(key);
  }
}

const processLast7Days = async (statKey = 'reward') => {

  // console.log('processLast7Days', window.cumulativeStats);

  const users = getUsers();

  const datasets = [];
  users.forEach((user, userIndex) => {
    datasets[userIndex] = {
      label: user.label || user.username,
      data: [],
      backgroundColor: colors[userIndex % colors.length],
      stack: user.username,
    }
  });

  window.cumulativeStats.forEach((dayStat, dayStatIndex) => {
    dayStat.forEach((stat, statIndex) => {
      datasets[statIndex].data[dayStatIndex] = stat[statKey];
    });
  });

  const barChartData = {
    labels: window.cumulativeStatslabels,
    datasets,
  };

  // console.log('barChartData', barChartData);

  buildBarChart(barChartData);

  // await getDatasets(window.date, users, colors).then(({ datasets, stats }) => {
  //   updateDate();
  //   // console.log('stats', stats);
  //   // console.log('datasets', datasets);
  //   buildChart(datasets);
  //   buildStats(stats);
  //   hideDOMProgress();
  // });
};

const buildBarChart = (data) => {

  let chartStatus = Chart.getChart("bar-chart"); // <canvas> id
  if (chartStatus != undefined) {
    chartStatus.destroy();
  }

  const barChartConfig = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      // interaction: {
      //   intersect: false,
      // },
      scales: {
        x: {
          // stacked: true,
          grid: {
            color: 'rgba(255,255,255,0.2)',
          },
          ticks: { color: '#fff' },
        },
        y: {
          // stacked: true,
          grid: {
            color: 'rgba(255,255,255,0.2)',
          },
          ticks: { color: '#fff' },
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#fff',
            boxWidth: 20,
            boxHeight: 20,
            font: {
              size: 16,
              family: "'Orbitron', 'sans-serif'",
            }
          },
        },
      },
    }
  };

  const chartDomEl = document
    .getElementById("bar-chart")
    .getContext("2d");

    const chart = new Chart(chartDomEl, barChartConfig);
}

const resetLast7DaysStats = () => {
  window.cumulativeStats = [];
  window.cumulativeStatslabels = [];
  document.querySelector('#last7DaysStats').innerHTML = '';
};

const buildLast7DaysStats = () => {
  const statsEl = document.querySelector('#last7DaysStats');

  const totalReward = window.cumulativeStats.reduce((acc, dayStat, dayStatIndex) => {
    dayStat.forEach((stat, statIndex) => {
      acc += stat.reward;
    });
    return acc;
  }, 0);

  let statsHTML = `
    <div class="col col-12 mb-4">
      <div class="card" style="min-height: 0;">
        <div class="card-body">
          <h5 class="card-title mb-0">Total 7 days rewards:<br><span class=""><span class="text-success number">+${round(totalReward * window.price)}</span> USDT</span> ≈ <span class=""><span class="text-warning number">${round3(totalReward)}</span> TLM</span></h5>
        </div>
      </div>
    </div>
  `;

  const users = getUsers();

  const allStats = users.reduce((acc, val) => {
    acc.push({
      label: val.label || val.username,
      username: val.username,
      reward: 0,
      count: 0,
      avgGain: 0,
      minGain: Infinity,
      maxGain: -Infinity,
      minGainDate: null,
      maxGainDate: null,
    })
    return acc;
  }, []);

  window.cumulativeStats.forEach((dayStat, dayStatIndex) => {
    dayStat.forEach((stat, statIndex) => {
      allStats[statIndex].reward += stat.reward;
      allStats[statIndex].count += stat.clicks;

      // allStats[statIndex].minGain = Math.min(allStats[statIndex].minGain, stat.reward);
      // allStats[statIndex].maxGain = Math.max(allStats[statIndex].maxGain, stat.reward);

      if (stat.reward <= allStats[statIndex].minGain) {
        allStats[statIndex].minGain = stat.reward;
        allStats[statIndex].minGainDate = stat.date;
      }

      if (stat.reward >= allStats[statIndex].maxGain) {
        allStats[statIndex].maxGain = stat.reward;
        allStats[statIndex].maxGainDate = stat.date;
      }
    });
  });

  allStats.forEach(stat => {
    stat.avgGain = stat.count ? stat.reward / stat.count : 0;
  });

  // console.log('allStats', allStats);

  allStats.forEach(stat => {
    statsHTML += `
      <div class="col col-12 col-md-4 mb-4">
        <div class="card">
          <div class="card-body">
              <h5 class="card-title">
                ${stat.label}:<br>
                <span><span class="text-success number">+${round(stat.reward * window.price)}</span> USDT</span>
                <span class="text-white-50 float-right"><span class="number">${round(stat.reward * 100 / (totalReward || 1))}</span>%</span>
              </h5>
              <div class="row align-items-center">
                <div class="col">
                  <span class="stats-value text-warning"><span class="number">${round3(stat.reward)}</span></span> <span class="stats-info">TLM</span>
                </div>
                <div class="col col-auto text-right">
                  <span class="stats-value"><span class="number">${stat.count}</span></span> <i class="icon-click"></i>
                </div>
              </div>
          </div>
        </div>

        <table class="table ${stat.username === 'XXX' ? 'hidden' : ''}">
          <tbody>
            <tr>
              <td class="small">AVG 7gg</td>
              <td><span class="number text-primary">${round3(stat.avgGain)}</span></td>
              <td><span class="small">per click</span></td>
            </tr>
            <tr>
              <td class="small">BEST day</td>
              <td><span class="number text-warning">${round3(stat.maxGain)}</span></td>
              <td><span class="number small">${toHumanDate(stat.maxGainDate)}</span></td>
            </tr>
            <tr>
              <td class="small">WORST day</td>
              <td><span class="number text-danger">${round3(stat.minGain)}</span></td>
              <td><span class="number small">${toHumanDate(stat.minGainDate)}</span></td>
            </tr>
          </tbody>
        </table>

      </div>
    `;

  //   <div>
  //   <span class="stats-value"><span class="number">${round(stat.avgGain)}</span></span> <span class="stats-info">avg</span>
  // </div>

  });

  statsEl.innerHTML = statsHTML;
}

const toHumanDate = (date) => {
  return date.toLocaleDateString();
};

const imgPath = 'https://ipfs.alienworlds.io/ipfs/';

window.assets = []
window.assetsMap = {};

const refreshAssets = async () => {
  window.assets = await getAssetsCache() || [];
  window.assetsMap = window.assets.reduce((acc, val) => {
    acc[val[0]] = val[1]; 
    return acc;
  }, {});
}

const getMiningAsset = async (assetId, type = 'tool') => { // tool, land
  const dbMap = type === 'land' ? window.landsMap : window.toolsMap;
  if (window.assetsMap[assetId]) {
    const templateId = window.assetsMap[assetId];
    return dbMap[templateId];
  } else {
    const assetsResponse = await myFetch([{ url: `https://atomicassets-api.alienworlds.io/atomicassets/v1/assets?page=1&limit=1&asset_id=${assetId}&collection_name=alien.worlds` }]);
    const asset = assetsResponse.data[0];
    if (asset && asset.template) {
      await setAssetCache(assetId, asset.template.template_id);
      await refreshAssets();
      return dbMap[asset.template.template_id];
    }
  }
}

// const getTool = async (assetId) => {
//   // assetId = 1099540506009;
//   const toolsResponse = await myFetch([{ url: `https://atomicassets-api.alienworlds.io/atomicassets/v1/assets?page=1&limit=1&asset_id=${assetId}&collection_name=alien.worlds` }]);
//   // console.log('toolsResponse', toolsResponse.data);

//   const tool = toolsResponse.data[0];
//   if (tool && tool.data) {
//     const name = tool.data.name;
//     const shine = tool.data.shine;
//     const rarity = tool.data.rarity;
//     const img = tool.data.img;
//     return {
//       name, img, shine, rarity,
//     };
//   }
//   return null;
// }

// const getLandAndPlanet = async (landId) => {
//   // landId = 1099512959825;
//   const toolsResponse = await myFetch([{ url: `https://atomicassets-api.alienworlds.io/atomicassets/v1/assets?page=1&limit=1&asset_id=${landId}&collection_name=alien.worlds` }]);
//   // console.log('toolsResponse', toolsResponse.data);

//   const tool = toolsResponse.data[0];
//   if (tool && tool.data) {
//     const name = tool.data.name;
//     const img = tool.data.img;
//     return {
//       name, img,
//     };
//   }
//   return null;
// }

const startApp = async () => {
  await refreshAssets();
  loadForm();
  console.log('started');
  window.progress = 0;
  window.price = 0;
  await updatePrice();
  setInterval(() => updatePrice, 5000);

  await window.update();
}

startApp();

