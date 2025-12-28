import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, Spacer, Static } from 'ink';
import axios from 'axios';
import asciichart from 'asciichart';
import WebSocket from 'ws';

// --- KONFIGURASI ---
const APP_NAME = "NEXUS TRADER X";
const VERSION = "v9.1-ANTI-CRASH";
const STARTING_BALANCE_IDR = 100000000;

// Config Awal
const INITIAL_COINS = [
    { id: 'bitcoin', symbol: 'btcusdt', name: 'Bitcoin', short: 'BTC' },
    { id: 'ethereum', symbol: 'ethusdt', name: 'Ethereum', short: 'ETH' },
    { id: 'solana', symbol: 'solusdt', name: 'Solana', short: 'SOL' },
    { id: 'binancecoin', symbol: 'bnbusdt', name: 'Binance', short: 'BNB' },
];

const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const formatCompact = (n) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(n);
const formatNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);

// --- 1. BOOT SCREEN ---
const BootScreen = ({ onBootComplete }) => {
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0);
    const logo = `
 ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
 ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
 ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
 ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
 ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
 ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
    >>> MARKET INTELLIGENCE SYSTEM <<<
    `;
    const sysLogs = ["Initializing...", "Bypassing Firewall...", "Connecting to Nodes...", "System Ready."];

    useEffect(() => {
        let step = 0;
        const total = sysLogs.length + 2;
        const t = setInterval(() => {
            step++;
            if (step < sysLogs.length) setLogs(p => [...p.slice(-3), `> ${sysLogs[step]}`]);
            setProgress(Math.min(100, Math.round((step / total) * 100)));
            if (step >= total) { clearInterval(t); onBootComplete(); }
        }, 100);
        return () => clearInterval(t);
    }, []);

    const bar = '█'.repeat(Math.round(progress / 5)) + '░'.repeat(20 - Math.round(progress / 5));
    const barColor = progress < 33 ? 'red' : progress < 66 ? 'yellow' : 'green';
    return (
        <Box flexDirection="column" padding={1} borderStyle="double" borderColor="cyan">
            <Text color="cyan" bold>{logo}</Text>
            <Box flexDirection="column" marginY={1}>{logs.map((l, i) => <Text key={i} color="greenBright">{l}</Text>)}</Box>
            <Text color={barColor} bold>LOADING: [{bar}] {progress}%</Text>
        </Box>
    );
};

// --- 2. SEARCH MODAL ---
const SearchModal = ({ onSelect, onCancel }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selIdx, setSelIdx] = useState(0);
    const [error, setError] = useState("");

    useInput(async (input, key) => {
        if (key.escape) onCancel();
        if (key.upArrow) setSelIdx(p => Math.max(0, p - 1));
        if (key.downArrow) setSelIdx(p => Math.min(results.length - 1, p + 1));
        if (!key.return && !key.upArrow && !key.downArrow) {
            if (key.delete || key.backspace) setQuery(p => p.slice(0, -1));
            else if (input && /^[a-zA-Z0-9\- ]$/.test(input)) setQuery(p => p + input);
        }
        if (key.return) {
            if (results.length > 0) onSelect(results[selIdx]);
            else if (query.length > 1) {
                setSearching(true); setError("");
                try {
                    const res = await axios.get(`https://api.coingecko.com/api/v3/search?query=${query}`);
                    const coins = res.data.coins.slice(0, 5).map(c => ({
                        id: c.id, symbol: c.symbol + 'usdt', name: c.name, short: c.symbol.toUpperCase(), rank: c.market_cap_rank
                    }));
                    if (coins.length === 0) setError("❌ Not Found.");
                    setResults(coins); setSelIdx(0);
                } catch (e) { setError("⚠️ API Error."); }
                setSearching(false);
            }
        }
    });

    return (
        <Box flexDirection="column" borderStyle="double" borderColor="magenta" padding={1} width={60}>
            <Text bold color="magentaBright">🔍 SEARCH CRYPTOCURRENCY</Text>
            <Box borderStyle="single" borderColor="cyan" paddingX={1} marginY={1}><Text color="cyan">{query}_</Text></Box>
            {searching && <Text color="yellow">⏳ Searching...</Text>}
            {error && <Text color="red">{error}</Text>}
            {results.map((c, i) => (
                <Text key={c.id} color={i === selIdx ? "magentaBright" : "white"} backgroundColor={i === selIdx ? "#330033" : "black"}>
                    {i === selIdx ? "▶ " : "  "}{c.name} ({c.short}) {c.rank ? `#${c.rank}` : ''}
                </Text>
            ))}
            <Box marginTop={1}><Text dimColor>[ENTER] Select | [ESC] Cancel</Text></Box>
        </Box>
    );
};

// --- 3. TRADE MODAL ---
const TradeModal = ({ type, coin, price, balance, holding, onConfirm, onCancel }) => {
    const [amount, setAmount] = useState("");
    const val = parseFloat(amount || 0);
    const estimasi = type === 'BUY' ? (val / price) : (val * price);
    const isBuy = type === 'BUY';

    useInput((input, key) => {
        if (key.escape) onCancel();
        if (key.backspace) setAmount(p => p.slice(0, -1));
        if (/[0-9.]/.test(input)) setAmount(p => p + input);
        if (key.return) {
            if (val <= 0) return;
            if (type === 'BUY' && val > balance) return;
            if (type === 'SELL' && val > holding) return;
            onConfirm(val);
        }
    });

    return (
        <Box flexDirection="column" borderStyle="double" borderColor={isBuy ? "green" : "red"} padding={1} width={60}>
            <Text bold backgroundColor="yellow" color="black"> ⚠️ SIMULATION ONLY - NOT REAL MONEY </Text>
            <Text bold color={isBuy ? "greenBright" : "redBright"} underline>{isBuy ? '💵 BUY' : '💸 SELL'}: {coin.name} ({coin.short})</Text>
            <Box borderStyle="single" borderColor="gray" padding={1} marginY={1} flexDirection="column">
                <Text>Current Price: <Text bold color="cyan">{formatRupiah(price)}</Text></Text>
                <Text>Available: <Text bold>{type === 'BUY' ? formatRupiah(balance) : `${formatNum(holding)} ${coin.short}`}</Text></Text>
            </Box>
            <Text color="cyan">Enter Amount (IDR):</Text>
            <Box borderStyle="single" borderColor="cyan" marginY={1} paddingX={1}><Text color="cyan" bold>{amount || '0'}_</Text></Box>
            <Text dimColor>→ Estimated: <Text bold color={isBuy ? "green" : "yellow"}>{type === 'BUY' ? `${formatNum(estimasi)} ${coin.short}` : formatRupiah(estimasi)}</Text></Text>
            <Box marginTop={1} justifyContent="space-between">
                <Text bold color="green">[ENTER] Confirm</Text>
                <Text bold color="red">[ESC] Cancel</Text>
            </Box>
        </Box>
    );
};

// --- 4. DASHBOARD ---
const DashboardScreen = ({
    prices, charts, loading, selectedIndex, usdrate,
    balance, rsiData, watchlist, wsStatus
}) => {
    const sConfig = watchlist[selectedIndex] || watchlist[0];
    const sData = prices[sConfig.symbol] || {};
    const sChart = charts[sConfig.symbol] || [];
    const sRSI = rsiData[sConfig.symbol] || 50;

    const isUp = (sData.change || 0) >= 0;
    const color = isUp ? "greenBright" : "redBright";
    const priceIDR = (sData.price || 0) * usdrate;

    let signal = "NEUTRAL";
    let signalColor = "white";
    if (sRSI > 70) { signal = "OVERBOUGHT ⚠️"; signalColor = "red"; }
    else if (sRSI < 30) { signal = "OVERSOLD 🎯"; signalColor = "green"; }

    if (loading) return <Text color="yellow">⏳ Syncing...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={color} padding={0}>
            <Box paddingX={1} backgroundColor="blue" justifyContent="space-between">
                <Text bold color="black" backgroundColor="yellow"> 🎮 SIMULATION MODE </Text>
                <Text color="white" bold>💰 {formatCompact(balance)}</Text>
            </Box>
            <Box paddingX={1} backgroundColor={color} justifyContent="space-between">
                <Text bold color="black"> {APP_NAME} </Text>
                <Text color="black" bold>{wsStatus ? "⚡ LIVE" : "⚠️ OFFLINE"}</Text>
            </Box>

            <Box>
                <Box flexDirection="column" width="35%" borderStyle="single" borderRight={true} borderColor="gray" paddingRight={1}>
                    {watchlist.map((c, i) => {
                        const isSel = i === selectedIndex;
                        const pData = prices[c.symbol] || {};
                        const pVal = (pData.price || 0) * usdrate;
                        const pIsUp = (pData.change || 0) >= 0;
                        return (
                            <Box key={c.id} justifyContent="space-between">
                                <Box>
                                    <Text color={isSel ? color : "gray"}>{isSel ? '● ' : '  '}</Text>
                                    <Text bold={isSel} color={isSel ? "white" : "gray"}>{c.short}</Text>
                                </Box>
                                <Text color={pIsUp ? "green" : "red"}>{formatCompact(pVal)}</Text>
                            </Box>
                        );
                    })}
                    <Box marginTop={1} borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="center">
                        <Text color="cyan" bold>[/] 🔍 Search</Text>
                    </Box>
                </Box>

                <Box flexDirection="column" width="65%" paddingLeft={1}>
                    <Box justifyContent="space-between">
                        <Text bold underline color="white">{sConfig.name} ({sConfig.short})</Text>
                        <Text bold color={color} backgroundColor={isUp ? "#003300" : "#330000"}> {isUp ? '📈' : '📉'} {sData.change > 0 ? '+' : ''}{(sData.change || 0).toFixed(2)}% </Text>
                    </Box>
                    <Text bold color={color} underline>{formatRupiah(priceIDR)}</Text>

                    <Box height={8} marginY={1}>
                        <Text color={color}>{asciichart.plot(sChart, { height: 8, padding: '      ' })}</Text>
                    </Box>

                    <Box borderStyle="single" borderColor="gray" padding={0} flexDirection="column">
                        <Box justifyContent="space-between" paddingX={1}>
                            <Text dimColor>24h High/Low:</Text>
                            <Text><Text color="green">{formatCompact((sData.high || 0) * usdrate)}</Text> / <Text color="red">{formatCompact((sData.low || 0) * usdrate)}</Text></Text>
                        </Box>
                        <Box borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} borderColor="gray" paddingX={1} justifyContent="space-between">
                            <Text bold color="cyan">RSI: {sRSI.toFixed(1)}</Text>
                            <Text bold color={signalColor}>{signal}</Text>
                        </Box>
                    </Box>

                    <Box marginTop={1} justifyContent="space-between">
                        <Text color="green" bold>[B] 💵 Buy</Text>
                        <Text color="red" bold>[S] 💸 Sell</Text>
                        <Text color="yellow" bold>[TAB] 💼 Portfolio</Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

// --- 5. PORTFOLIO ---
const PortfolioScreen = ({ balance, holdings, prices, usdrate }) => {
    let totalVal = balance;
    let items = [];
    Object.keys(holdings).forEach(s => {
        if (holdings[s] > 0) {
            const val = holdings[s] * (prices[s]?.price || 0) * usdrate;
            totalVal += val;
            items.push({ name: s.toUpperCase(), qty: holdings[s], val: val });
        }
    });
    const pnl = totalVal - STARTING_BALANCE_IDR;
    const pnlPercent = ((pnl / STARTING_BALANCE_IDR) * 100).toFixed(2);
    const isProfitable = pnl >= 0;

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
            <Text bold color="black" backgroundColor="yellow"> 💼 PORTFOLIO SUMMARY </Text>
            <Box marginY={1} borderStyle="double" borderColor={isProfitable ? "green" : "red"} padding={1} flexDirection="column">
                <Text>Net Worth: <Text bold color="cyan">{formatRupiah(totalVal)}</Text></Text>
                <Text>Cash Balance: <Text bold color="white">{formatRupiah(balance)}</Text></Text>
                <Text>Total P&L: <Text bold color={isProfitable ? "greenBright" : "redBright"}>{isProfitable ? '📈' : '📉'} {formatRupiah(pnl)} ({isProfitable ? '+' : ''}{pnlPercent}%)</Text></Text>
            </Box>
            <Text bold color="yellow" underline>📦 Holdings:</Text>
            <Box flexDirection="column" marginTop={1}>
                {items.length === 0 ? <Text dimColor>• No assets yet. Start trading!</Text> : items.map((i, k) => (
                    <Box key={k} justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text bold color="yellow">• {i.name}</Text>
                        <Text color="white">{formatNum(i.qty)}</Text>
                        <Text color="cyan">{formatCompact(i.val)}</Text>
                    </Box>
                ))}
            </Box>
            <Spacer /><Text color="cyan" bold marginTop={1}>[TAB] Back to Market</Text>
        </Box>
    );
};

// --- MAIN APP ---
const App = () => {
    const [booting, setBooting] = useState(true);
    const [view, setView] = useState('market');
    const [selIdx, setSelIdx] = useState(0);
    const [watchlist, setWatchlist] = useState(INITIAL_COINS);
    const [prices, setPrices] = useState({});
    const [charts, setCharts] = useState({});
    const [rsiData, setRsiData] = useState({});
    const [usdrate, setUsdRate] = useState(16000);
    const [loading, setLoading] = useState(true);
    const [wsStatus, setWsStatus] = useState(false); // Status Koneksi

    const [balance, setBalance] = useState(STARTING_BALANCE_IDR);
    const [holdings, setHoldings] = useState({});
    const chartsRef = useRef({});
    const wsRef = useRef(null);

    // --- FUNGSI PENTING: CONNECT WS DENGAN ANTI-CRASH ---
    const connectWS = (coins) => {
        try {
            if (wsRef.current) wsRef.current.close();

            const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${coins.map(c => c.symbol + '@ticker').join('/')}`);

            ws.on('open', () => {
                setWsStatus(true);
            });

            ws.on('message', (d) => {
                const { stream, data } = JSON.parse(d);
                const s = stream.split('@')[0];
                const price = parseFloat(data.c);
                setPrices(p => ({ ...p, [s]: { price, change: parseFloat(data.P), high: parseFloat(data.h), low: parseFloat(data.l) } }));
                const curChart = chartsRef.current[s] || [];
                // FIX: Ensure chart has data before slicing
                if (curChart.length === 0) {
                    chartsRef.current[s] = [price];
                    setCharts(p => ({ ...p, [s]: [price] }));
                } else {
                    const newChart = curChart.length >= 50 ? [...curChart.slice(1), price] : [...curChart, price];
                    chartsRef.current[s] = newChart;
                    setCharts(p => ({ ...p, [s]: newChart }));
                }
                setRsiData(p => ({ ...p, [s]: calculateRSI(chartsRef.current[s]) }));
            });

            // ERROR HANDLING BIAR GAK CRASH
            ws.on('error', (e) => {
                setWsStatus(false);
                // Jangan throw error, cukup log atau diamkan
            });

            ws.on('close', () => {
                setWsStatus(false);
                // Coba reconnect setelah 5 detik
                setTimeout(() => connectWS(watchlist), 5000);
            });

            wsRef.current = ws;
        } catch (error) {
            setWsStatus(false);
        }
    };

    const fetchData = async (coinsToFetch) => {
        try {
            const ids = coinsToFetch.map(c => c.id).join(',');
            const [rateRes, histRes] = await Promise.all([
                axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr'),
                axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true`)
            ]);
            setUsdRate(rateRes.data.tether.idr);
            const initC = { ...chartsRef.current }; const initP = { ...prices }; const initRSI = { ...rsiData };
            histRes.data.forEach(c => {
                const cfg = coinsToFetch.find(x => x.id === c.id);
                if (cfg) {
                    const hist = c.sparkline_in_7d.price.slice(-50);
                    initC[cfg.symbol] = hist;
                    initP[cfg.symbol] = { price: c.current_price, change: c.price_change_percentage_24h, high: c.high_24h, low: c.low_24h };
                    initRSI[cfg.symbol] = calculateRSI(hist);
                }
            });
            chartsRef.current = initC; setCharts(initC); setPrices(initP); setRsiData(initRSI);
        } catch (e) { }
    };

    useEffect(() => {
        const init = async () => {
            await fetchData(watchlist);
            connectWS(watchlist);
            setLoading(false);
        };
        init();
    }, []);

    const handleAddCoin = async (newCoin) => {
        if (watchlist.find(c => c.id === newCoin.id)) { setView('market'); return; }
        const updatedList = [...watchlist, newCoin];
        setWatchlist(updatedList);
        setLoading(true); setView('market');
        // FIX: Wait for fetchData to complete BEFORE connecting WebSocket
        await fetchData([newCoin]);
        // This ensures chart data is initialized before WS starts streaming
        connectWS(updatedList);
        setSelIdx(updatedList.length - 1);
        setLoading(false);
    };

    useInput((input, key) => {
        if (booting) return;
        if (view.startsWith('trade') || view === 'search') return;
        if (key.tab) setView(v => v === 'market' ? 'portfolio' : 'market');
        if (input === '/') setView('search');
        if (view === 'market') {
            if (key.upArrow) setSelIdx(p => (p > 0 ? p - 1 : watchlist.length - 1));
            if (key.downArrow) setSelIdx(p => (p < watchlist.length - 1 ? p + 1 : 0));
            if (input === 'b' || input === 'B') setView('trade_buy');
            if (input === 's' || input === 'S') setView('trade_sell');
        }
    });

    const executeTrade = (type, val) => {
        const coin = watchlist[selIdx];
        const p = (prices[coin.symbol]?.price || 0) * usdrate;
        if (type === 'BUY') {
            setBalance(b => b - val);
            setHoldings(h => ({ ...h, [coin.symbol]: (h[coin.symbol] || 0) + (val / p) }));
        } else {
            setBalance(b => b + (val * p));
            setHoldings(h => ({ ...h, [coin.symbol]: (h[coin.symbol] || 0) - val }));
        }
        setView('market');
    };

    if (booting) return <BootScreen onBootComplete={() => setBooting(false)} />;
    if (view === 'search') return <SearchModal onSelect={handleAddCoin} onCancel={() => setView('market')} />;
    if (view.startsWith('trade')) {
        const coin = watchlist[selIdx];
        const p = (prices[coin.symbol]?.price || 0) * usdrate;
        const hold = holdings[coin.symbol] || 0;
        return <TradeModal type={view === 'trade_buy' ? 'BUY' : 'SELL'} coin={coin} price={p} balance={balance} holding={hold} onConfirm={(v) => executeTrade(view === 'trade_buy' ? 'BUY' : 'SELL', v)} onCancel={() => setView('market')} />;
    }
    if (view === 'portfolio') return <PortfolioScreen balance={balance} holdings={holdings} prices={prices} usdrate={usdrate} />;
    return <DashboardScreen prices={prices} charts={charts} loading={loading} selectedIndex={selIdx} usdrate={usdrate} balance={balance} rsiData={rsiData} watchlist={watchlist} wsStatus={wsStatus} />;
};

render(<App />);
