// State Management
let selectedAssetId = 'fxaix';
let selectedDays = '1';
let marketChartInstance = null;
let activeAlerts = [];
let currentMarketData = [];

// List of tracked crypto asset IDs for CoinGecko API
const trackedAssets = ['bitcoin', 'ethereum', 'solana', 'cardano'];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    fetchMarketData();
    // Auto-refresh market data every 30 seconds
    setInterval(fetchMarketData, 30000);
});

// 1. Fetch Live Market Data
async function fetchMarketData() {
    const statusText = document.getElementById('last-updated');
    statusText.innerHTML = `<i class="fa-solid fa-sync fa-spin"></i> Updating...`;

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${trackedAssets.join(',')}&order=market_cap_desc&per_page=10&page=1&sparkline=false`
        );
        
        let cryptoData = [];
        if (response.ok) {
            cryptoData = await response.json();
        }

        let sp500Price = 267.30;
        let sp500Change = 0.45;

        try {
            const spResponse = await fetch('https://api.coingecko.com/api/v3/coins/vanguard-s-p-500-etf-dinari-tokenized-etf');
            if (spResponse.ok) {
                const spData = await spResponse.json();
                if (spData.market_data?.current_price?.usd) {
                    sp500Price = spData.market_data.current_price.usd / 2.65;
                    sp500Change = spData.market_data.price_change_percentage_24h || 0.45;
                }
            }
        } catch (err) {
            console.error("FXAIX proxy fetch failed:", err);
        }

        const fxaixAsset = {
            id: 'fxaix',
            name: 'Fidelity 500 (FXAIX)',
            symbol: 'fxaix',
            current_price: sp500Price,
            price_change_percentage_24h: sp500Change
        };
        currentMarketData = [fxaixAsset, ...cryptoData];

        renderTickerCards(currentMarketData);
        const selectedAsset = currentMarketData.find(asset => asset.id === selectedAssetId);
        if (selectedAsset) {
            document.getElementById('chart-asset-title').innerText = selectedAsset.name;
            document.getElementById('chart-asset-price').innerText = `$${selectedAsset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        fetchHistoricalChartData(selectedAssetId, selectedDays);
        checkPriceAlerts(currentMarketData);

        const now = new Date();
        statusText.innerHTML = `<i class="fa-solid fa-circle" style="color: #22c55e;"></i> Updated: ${now.toLocaleTimeString()}`;
    } catch (err) {
        console.error("Fetch Error:", err);
        statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Fetch Failed`;
    }
}

// 2. Render Ticker Cards
function renderTickerCards(assets) {
    const grid = document.getElementById('ticker-grid');
    grid.innerHTML = '';

    assets.forEach(asset => {
        const isSelected = asset.id === selectedAssetId;
        const changeIsPositive = asset.price_change_percentage_24h >= 0;
        const changeClass = changeIsPositive ? 'positive' : 'negative';
        const changeIcon = changeIsPositive ? 'fa-caret-up' : 'fa-caret-down';

        const card = document.createElement('div');
        card.className = `card ${isSelected ? 'active-card' : ''}`;
        card.onclick = () => selectAsset(asset.id, asset.name, asset.current_price);

        card.innerHTML = `
            <div class="card-header-row">
                <span class="asset-symbol">${asset.name}</span>
                <i class="fa-solid ${asset.id === 'fxaix' ? 'fa-chart-pie' : 'fa-coins'}" style="color: #38bdf8;"></i>
            </div>
            <div class="card-price">$${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="price-change ${changeClass}">
                <i class="fa-solid ${changeIcon}"></i>
                ${asset.price_change_percentage_24h ? asset.price_change_percentage_24h.toFixed(2) : '0.00'}% (24h)
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. Select Active Asset
function selectAsset(assetId, assetName, assetPrice) {
    selectedAssetId = assetId;
    document.getElementById('chart-asset-title').innerText = `${assetName}`;
    document.getElementById('chart-asset-price').innerText = `$${assetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Re-render cards to highlight selected active card
    renderTickerCards(currentMarketData);
    fetchHistoricalChartData(selectedAssetId, selectedDays);
}

// 4. Change Timeframe (24h, 7d, 30d)
function changeTimeframe(days) {
    selectedDays = days;
    document.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    fetchHistoricalChartData(selectedAssetId, selectedDays);
}

// 5. Fetch Historical Chart Data
async function fetchHistoricalChartData(assetId, days) {
    try {
        const fetchId = assetId === 'fxaix' ? 'vanguard-s-p-500-etf-dinari-tokenized-etf' : assetId;
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${fetchId}/market_chart?vs_currency=usd&days=${days}`
        );
        const data = await response.json();
        if (!data.prices) return;

        // Process timestamps and prices from array [[time, price], ...]
        const labels = data.prices.map(item => {
            const date = new Date(item[0]);
            return days === '1' 
                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        });

        const scaleFactor = assetId === 'fxaix' ? 2.65 : 1;
        const prices = data.prices.map(item => item[1] / scaleFactor);

        updateChart(labels, prices);
    } catch (err) {
        console.error("Chart fetch failed:", err);
    }
}

// 6. Chart.js Setup & Updates
function initChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    
    marketChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price (USD)',
                data: [],
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: '#232d42' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: '#232d42' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function updateChart(labels, prices) {
    if (!marketChartInstance) return;
    marketChartInstance.data.labels = labels;
    marketChartInstance.data.datasets[0].data = prices;
    marketChartInstance.update();
}

// 7. Price Alert System Logic
function setPriceAlert() {
    const assetSelect = document.getElementById('alert-asset');
    const targetPriceInput = document.getElementById('alert-target-price');

    const assetId = assetSelect.value;
    const targetPrice = parseFloat(targetPriceInput.value);

    if (!targetPrice || targetPrice <= 0) {
        alert("Please enter a valid target price!");
        return;
    }

    const newAlert = {
        id: Date.now(),
        assetId: assetId,
        targetPrice: targetPrice
    };

    activeAlerts.push(newAlert);
    targetPriceInput.value = '';
    renderAlerts();
}

function renderAlerts() {
    const list = document.getElementById('active-alerts-list');
    list.innerHTML = '';

    if (activeAlerts.length === 0) {
        list.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8;">No active alerts set.</span>`;
        return;
    }

    activeAlerts.forEach(alertItem => {
        const item = document.createElement('div');
        item.className = 'alert-item';
        item.innerHTML = `
            <span><strong>${alertItem.assetId.toUpperCase()}</strong> > $${alertItem.targetPrice.toLocaleString()}</span>
            <i class="fa-solid fa-trash" style="color:#ef4444; cursor:pointer;" onclick="removeAlert(${alertItem.id})"></i>
        `;
        list.appendChild(item);
    });
}

function removeAlert(alertId) {
    activeAlerts = activeAlerts.filter(a => a.id !== alertId);
    renderAlerts();
}

function checkPriceAlerts(data) {
    activeAlerts.forEach(alertItem => {
        const asset = data.find(a => a.id === alertItem.assetId);
        if (asset && asset.current_price >= alertItem.targetPrice) {
            alert(`🚨 MARKET ALERT: ${asset.name} has crossed your target price of $${alertItem.targetPrice}! Current price: $${asset.current_price}`);
            removeAlert(alertItem.id);
        }
    });
}