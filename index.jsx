import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, Spacer, useStdout } from 'ink';
import axios from 'axios';
import asciichart from 'asciichart';
import WebSocket from 'ws';

// --- KONFIGURASI ---
const APP_NAME = "NEXUS TRADER X";
const VERSION = "v10.2-BLOOMBERG";
const STARTING_BALANCE_IDR = 100000000;

// PROFESSIONAL ICONS
const ICONS = {
    LIVE: '⚡', OFFLINE: '⊗', UP: '▲', DOWN: '▼', BULLET: '●', ARROW: '▶',
    MARKET: '▣', SIMULATION: '◈', NEWS: '◉', EDUCATION: '◈', PORTFOLIO: '▦',
    BUY: '▲', SELL: '▼', SEARCH: '⊙', EXIT: '⊠', WARNING: '⚠',
    SUCCESS: '✓', ERROR: '✗', TRENDING: '⚡', INFO: 'ℹ', LOADING: '⟳'
};

// Binance symbol mapping untuk coins yang umum
const BINANCE_SYMBOL_MAP = {
    'bitcoin': 'btcusdt',
    'ethereum': 'ethusdt',
    'solana': 'solusdt',
    'binancecoin': 'bnbusdt',
    'ripple': 'xrpusdt',
    'cardano': 'adausdt',
    'dogecoin': 'dogeusdt',
    'polkadot': 'dotusdt',
    'matic-network': 'maticusdt',
    'litecoin': 'ltcusdt',
    'avalanche-2': 'avaxusdt',
    'chainlink': 'linkusdt'
};

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
const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false });

// --- CANDLESTICK CHART (TRADINGVIEW STYLE) ---
const CandlestickChart = ({ data, height }) => {
    if (!data || data.length < 4) {
        return <Text color="yellow">{ICONS.LOADING} Waiting for data...</Text>;
    }

    // Aggregate every 4 prices into 1 candle (OHLC)
    const candleSize = 4;
    const candles = [];
    for (let i = 0; i < data.length; i += candleSize) {
        const chunk = data.slice(i, i + candleSize);
        if (chunk.length > 0) {
            candles.push({
                open: chunk[0],
                high: Math.max(...chunk),
                low: Math.min(...chunk),
                close: chunk[chunk.length - 1]
            });
        }
    }

    if (candles.length === 0) return <Text color="yellow">Loading...</Text>;

    // Normalize candles to fit height
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const globalMin = Math.min(...allPrices);
    const globalMax = Math.max(...allPrices);
    const range = globalMax - globalMin || 1;

    const normalize = (val) => Math.round(((val - globalMin) / range) * (height - 1));

    // Build candlestick display
    const lines = [];
    for (let h = height - 1; h >= 0; h--) {
        const line = [];
        for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];
            const isGreen = candle.close >= candle.open;
            const color = isGreen ? 'green' : 'red';

            const highNorm = normalize(candle.high);
            const lowNorm = normalize(candle.low);
            const openNorm = normalize(candle.open);
            const closeNorm = normalize(candle.close);

            const bodyTop = Math.max(openNorm, closeNorm);
            const bodyBottom = Math.min(openNorm, closeNorm);

            // Wick + Body rendering
            if (h > bodyTop && h <= highNorm) {
                line.push({ char: '│', color }); // Upper wick
            } else if (h >= bodyBottom && h <= bodyTop) {
                line.push({ char: '█', color }); // Body
            } else if (h >= lowNorm && h < bodyBottom) {
                line.push({ char: '│', color }); // Lower wick
            } else {
                line.push({ char: ' ', color: 'white' });
            }
        }
        lines.push(line);
    }

    return (
        <Box flexDirection="column">
            {lines.map((line, i) => (
                <Box key={i}>
                    {line.map((cell, j) => (
                        <Text key={j} color={cell.color}>{cell.char}</Text>
                    ))}
                </Box>
            ))}
        </Box>
    );
};

// --- TICKER TAPE ---
const TickerTape = ({ watchlist, prices, usdrate }) => {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setOffset(p => p + 1), 100);
        return () => clearInterval(interval);
    }, []);

    const items = watchlist.map(c => {
        const data = prices[c.symbol] || {};
        const isUp = (data.change || 0) >= 0;
        const price = formatCompact((data.price || 0) * usdrate);
        const change = (data.change || 0).toFixed(2);
        return `${c.short} ${isUp ? ICONS.UP : ICONS.DOWN} ${price} ${isUp ? '+' : ''}${change}%`;
    });

    const tape = items.join(' │ ') + ' │ ';
    const repeated = tape.repeat(5);
    const visible = repeated.substring(offset % tape.length);

    return <Text>{visible.substring(0, 150)}</Text>;
};

// --- LIVE CLOCK ---
const LiveClock = () => {
    const [time, setTime] = useState(getTime());
    useEffect(() => {
        const interval = setInterval(() => setTime(getTime()), 1000);
        return () => clearInterval(interval);
    }, []);
    return <Text>{time}</Text>;
};

// --- TOP MOVERS ---
const TopMovers = ({ watchlist, prices }) => {
    const withChanges = watchlist.map(c => ({
        short: c.short,
        change: prices[c.symbol]?.change || 0
    })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const gainers = withChanges.filter(c => c.change > 0).slice(0, 3);
    const losers = withChanges.filter(c => c.change < 0).slice(0, 3);

    return (
        <Box flexDirection="column">
            <Box>
                <Box width="50%" flexDirection="column">
                    <Text bold color="green">{ICONS.TRENDING} TOP GAINERS</Text>
                    {gainers.map((c, i) => (
                        <Text key={i} color="green">{c.short}  {ICONS.UP} +{c.change.toFixed(2)}%</Text>
                    ))}
                </Box>
                <Box width="50%" flexDirection="column">
                    <Text bold color="red">{ICONS.WARNING} TOP LOSERS</Text>
                    {losers.map((c, i) => (
                        <Text key={i} color="red">{c.short}  {ICONS.DOWN} {c.change.toFixed(2)}%</Text>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

// --- BOOT SCREEN ---
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
      >>> BLOOMBERG-STYLE TERMINAL <<<
    `;
    const sysLogs = ["Initializing Core...", "Loading Market Data...", "Connecting WebSocket...", "System Ready!"];

    useEffect(() => {
        let step = 0;
        const total = sysLogs.length + 2;
        const t = setInterval(() => {
            step++;
            if (step < sysLogs.length) setLogs(p => [...p.slice(-3), `${ICONS.ARROW} ${sysLogs[step]}`]);
            setProgress(Math.min(100, Math.round((step / total) * 100)));
            if (step >= total) { clearInterval(t); onBootComplete(); }
        }, 150);
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

// --- SEARCH MODAL ---
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
                    if (coins.length === 0) setError(`${ICONS.ERROR} Not Found.`);
                    setResults(coins); setSelIdx(0);
                } catch (e) { setError(`${ICONS.WARNING} API Error.`); }
                setSearching(false);
            }
        }
    });

    return (
        <Box flexDirection="column" borderStyle="double" borderColor="magenta" padding={1} width={60}>
            <Text bold color="magentaBright">{ICONS.SEARCH} SEARCH CRYPTOCURRENCY</Text>
            <Box borderStyle="single" borderColor="cyan" paddingX={1} marginY={1}><Text color="cyan">{query}_</Text></Box>
            {searching && <Text color="yellow">{ICONS.LOADING} Searching...</Text>}
            {error && <Text color="red">{error}</Text>}
            {results.map((c, i) => (
                <Text key={c.id} color={i === selIdx ? "magentaBright" : "white"} backgroundColor={i === selIdx ? "#330033" : "black"}>
                    {i === selIdx ? `${ICONS.ARROW} ` : "  "}{c.name} ({c.short}) {c.rank ? `#${c.rank}` : ''}
                </Text>
            ))}
            <Box marginTop={1}><Text dimColor>[ENTER] Select | [ESC] Cancel</Text></Box>
        </Box>
    );
};

// --- TRADE MODAL ---
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
            <Text bold backgroundColor="yellow" color="black"> {ICONS.WARNING} SIMULATION - PRACTICE TRADING </Text>
            <Text bold color={isBuy ? "greenBright" : "redBright"} underline>{isBuy ? `${ICONS.BUY} BUY` : `${ICONS.SELL} SELL`}: {coin.name} ({coin.short})</Text>
            <Box borderStyle="single" borderColor="gray" padding={1} marginY={1} flexDirection="column">
                <Text>Current Price: <Text bold color="cyan">{formatRupiah(price)}</Text></Text>
                <Text>Available: <Text bold>{type === 'BUY' ? formatRupiah(balance) : `${formatNum(holding)} ${coin.short}`}</Text></Text>
            </Box>
            <Text color="cyan">Enter Amount (IDR):</Text>
            <Box borderStyle="single" borderColor="cyan" marginY={1} paddingX={1}><Text color="cyan" bold>{amount || '0'}_</Text></Box>
            <Text dimColor>{ICONS.ARROW} Estimated: <Text bold color={isBuy ? "green" : "yellow"}>{type === 'BUY' ? `${formatNum(estimasi)} ${coin.short}` : formatRupiah(estimasi)}</Text></Text>
            <Box marginTop={1} justifyContent="space-between">
                <Text bold color="green">[ENTER] Confirm</Text>
                <Text bold color="red">[ESC] Cancel</Text>
            </Box>
        </Box>
    );
};

// --- BLOOMBERG MARKET DASHBOARD ---
const BloombergMarketDashboard = ({
    prices, charts, loading, selectedIndex, usdrate,
    rsiData, watchlist, wsStatus, onOpenSearch, onChangeIndex, onExit
}) => {
    const { stdout } = useStdout();
    const termHeight = stdout?.rows || 30;
    const chartHeight = Math.max(12, termHeight - 18);

    const sConfig = watchlist[selectedIndex] || watchlist[0];
    const sData = prices[sConfig.symbol] || {};
    const sChart = charts[sConfig.symbol] || [];
    const sRSI = rsiData[sConfig.symbol] || 50;

    const isUp = (sData.change || 0) >= 0;

    let chartColor = "white";
    if (sChart.length >= 5) {
        const recent = sChart.slice(-5);
        const trend = recent[recent.length - 1] - recent[0];
        chartColor = trend >= 0 ? "greenBright" : "redBright";
    }

    const priceIDR = (sData.price || 0) * usdrate;

    let signal = "NEUTRAL";
    let signalColor = "white";
    if (sRSI > 70) { signal = `OVERBOUGHT ${ICONS.WARNING}`; signalColor = "red"; }
    else if (sRSI < 30) { signal = `OVERSOLD ${ICONS.SUCCESS}`; signalColor = "green"; }

    // Calculate total market cap
    let totalMcap = 0;
    let totalVol = 0;
    watchlist.forEach(c => {
        const p = prices[c.symbol];
        if (p) {
            totalMcap += (p.price || 0) * 21000000000; // Simplified
            totalVol += (p.price || 0) * 50000000; // Simplified
        }
    });

    useInput((input, key) => {
        if (input === '/') onOpenSearch();
        if (key.upArrow) onChangeIndex(-1);
        if (key.downArrow) onChangeIndex(1);
        if (input === 'q' || input === 'Q') onExit();
    });

    if (loading) return <Text color="yellow">{ICONS.LOADING} Loading Market Data...</Text>;

    return (
        <Box flexDirection="column" height={termHeight} borderStyle="round" borderColor={chartColor}>
            {/* TOP BAR */}
            <Box paddingX={1} backgroundColor="blue" justifyContent="space-between">
                <Text bold color="white">{APP_NAME} {VERSION}</Text>
                <LiveClock />
                <Text color="white" bold>{wsStatus ? `${ICONS.LIVE} LIVE` : `${ICONS.OFFLINE} OFFLINE`}</Text>
                <Text color="yellow" bold>{ICONS.MARKET} MARKET</Text>
            </Box>

            {/* TICKER TAPE */}
            <Box paddingX={1} backgroundColor="black">
                <TickerTape watchlist={watchlist} prices={prices} usdrate={usdrate} />
            </Box>

            {/* MAIN CONTENT */}
            <Box flexGrow={1}>
                {/* WATCHLIST PANEL */}
                <Box flexDirection="column" width="35%" borderStyle="single" borderRight={true} borderColor="gray" paddingX={1}>
                    <Text bold color="cyan" underline>WATCHLIST</Text>
                    {watchlist.map((c, i) => {
                        const isSel = i === selectedIndex;
                        const pData = prices[c.symbol] || {};
                        const pVal = (pData.price || 0) * usdrate;
                        const pIsUp = (pData.change || 0) >= 0;
                        const pChange = (pData.change || 0).toFixed(2);
                        return (
                            <Box key={c.id} flexDirection="column" marginY={0}>
                                <Box justifyContent="space-between">
                                    <Text color={isSel ? chartColor : "gray"} bold={isSel}>
                                        {isSel ? `${ICONS.BULLET} ` : '  '}{c.short}
                                    </Text>
                                    <Text color={pIsUp ? "green" : "red"}>{formatCompact(pVal)}</Text>
                                </Box>
                                {isSel && (
                                    <Text dimColor>  {pIsUp ? '+' : ''}{pChange}% | RSI: {(rsiData[c.symbol] || 50).toFixed(0)}</Text>
                                )}
                            </Box>
                        );
                    })}
                    <Box marginTop={1} borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="center">
                        <Text color="cyan" bold>[/] {ICONS.SEARCH} Search</Text>
                    </Box>
                </Box>

                {/* CHART PANEL */}
                <Box flexDirection="column" width="65%" paddingX={1}>
                    <Box justifyContent="space-between">
                        <Text bold color="white">{sConfig.name} ({sConfig.short})</Text>
                        <Text bold color={isUp ? "greenBright" : "redBright"} backgroundColor={isUp ? "#003300" : "#330000"}>
                            {isUp ? ICONS.UP : ICONS.DOWN} {sData.change > 0 ? '+' : ''}{(sData.change || 0).toFixed(2)}%
                        </Text>
                    </Box>
                    <Text bold color={chartColor} underline>{formatRupiah(priceIDR)}</Text>

                    <Box height={chartHeight} marginY={1}>
                        <CandlestickChart data={sChart} height={chartHeight} />
                    </Box>

                    <Box borderStyle="single" borderColor="gray" padding={0} flexDirection="column">
                        <Box justifyContent="space-between" paddingX={1}>
                            <Text dimColor>24h Range:</Text>
                            <Text>
                                <Text color="green">{formatCompact((sData.high || 0) * usdrate)}</Text>
                                {' - '}
                                <Text color="red">{formatCompact((sData.low || 0) * usdrate)}</Text>
                            </Text>
                        </Box>
                        <Box borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} borderColor="gray" paddingX={1} justifyContent="space-between">
                            <Text bold color="cyan">RSI: {sRSI.toFixed(1)}</Text>
                            <Text bold color={signalColor}>{signal}</Text>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* MARKET STATS PANEL */}
            <Box borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} borderColor="gray" paddingX={1} flexDirection="column">
                <Text bold color="cyan">MARKET STATISTICS</Text>
                <Box justifyContent="space-between">
                    <Text>Total MCap: <Text color="cyan">{formatCompact(totalMcap * usdrate)}</Text></Text>
                    <Text>24h Vol: <Text color="cyan">{formatCompact(totalVol * usdrate)}</Text></Text>
                    <Text>BTC Dom: <Text color="yellow">52.3%</Text></Text>
                </Box>
                <TopMovers watchlist={watchlist} prices={prices} />
            </Box>

            {/* FOOTER */}
            <Box paddingX={1} justifyContent="space-between" backgroundColor="#111111">
                <Text color="yellow" bold>[S] {ICONS.SIMULATION} Simulation</Text>
                <Text color="magenta" bold>[N] {ICONS.NEWS} News</Text>
                <Text color="cyan" bold>[E] {ICONS.EDUCATION} Learn</Text>
                <Text color="red" bold>[Q] {ICONS.EXIT} Exit</Text>
            </Box>
        </Box>
    );
};

// --- SIMULATION DASHBOARD (Similar Bloomberg style) ---
const SimulationDashboard = ({
    prices, charts, loading, selectedIndex, usdrate,
    balance, rsiData, watchlist, wsStatus, onOpenTrade, onChangeIndex, onExit
}) => {
    const { stdout } = useStdout();
    const termHeight = stdout?.rows || 30;
    const chartHeight = Math.max(12, termHeight - 18);

    const sConfig = watchlist[selectedIndex] || watchlist[0];
    const sData = prices[sConfig.symbol] || {};
    const sChart = charts[sConfig.symbol] || [];
    const sRSI = rsiData[sConfig.symbol] || 50;

    const isUp = (sData.change || 0) >= 0;

    let chartColor = "white";
    if (sChart.length >= 5) {
        const recent = sChart.slice(-5);
        const trend = recent[recent.length - 1] - recent[0];
        chartColor = trend >= 0 ? "greenBright" : "redBright";
    }

    const priceIDR = (sData.price || 0) * usdrate;

    let signal = "NEUTRAL";
    let signalColor = "white";
    if (sRSI > 70) { signal = `OVERBOUGHT ${ICONS.WARNING}`; signalColor = "red"; }
    else if (sRSI < 30) { signal = `OVERSOLD ${ICONS.SUCCESS}`; signalColor = "green"; }

    useInput((input, key) => {
        if (key.upArrow) onChangeIndex(-1);
        if (key.downArrow) onChangeIndex(1);
        if (input === 'b' || input === 'B') onOpenTrade('BUY');
        if (input === 's' || input === 'S') onOpenTrade('SELL');
        if (input === 'q' || input === 'Q') onExit();
    });

    if (loading) return <Text color="yellow">{ICONS.LOADING} Loading...</Text>;

    return (
        <Box flexDirection="column" height={termHeight} borderStyle="round" borderColor="yellow">
            <Box paddingX={1} backgroundColor="yellow" justifyContent="space-between">
                <Text bold color="black">{ICONS.SIMULATION} SIMULATION MODE</Text>
                <LiveClock />
                <Text color="black" bold>Balance: {formatCompact(balance)}</Text>
            </Box>

            <Box paddingX={1} backgroundColor="black">
                <TickerTape watchlist={watchlist} prices={prices} usdrate={usdrate} />
            </Box>

            <Box flexGrow={1}>
                <Box flexDirection="column" width="35%" borderStyle="single" borderRight={true} borderColor="gray" paddingX={1}>
                    <Text bold color="cyan" underline>WATCHLIST</Text>
                    {watchlist.map((c, i) => {
                        const isSel = i === selectedIndex;
                        const pData = prices[c.symbol] || {};
                        const pVal = (pData.price || 0) * usdrate;
                        const pIsUp = (pData.change || 0) >= 0;
                        const pChange = (pData.change || 0).toFixed(2);
                        return (
                            <Box key={c.id} flexDirection="column" marginY={0}>
                                <Box justifyContent="space-between">
                                    <Text color={isSel ? chartColor : "gray"} bold={isSel}>
                                        {isSel ? `${ICONS.BULLET} ` : '  '}{c.short}
                                    </Text>
                                    <Text color={pIsUp ? "green" : "red"}>{formatCompact(pVal)}</Text>
                                </Box>
                                {isSel && (
                                    <Text dimColor>  {pIsUp ? '+' : ''}{pChange}% | RSI: {(rsiData[c.symbol] || 50).toFixed(0)}</Text>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                <Box flexDirection="column" width="65%" paddingX={1}>
                    <Box justifyContent="space-between">
                        <Text bold color="white">{sConfig.name} ({sConfig.short})</Text>
                        <Text bold color={isUp ? "greenBright" : "redBright"} backgroundColor={isUp ? "#003300" : "#330000"}>
                            {isUp ? ICONS.UP : ICONS.DOWN} {sData.change > 0 ? '+' : ''}{(sData.change || 0).toFixed(2)}%
                        </Text>
                    </Box>
                    <Text bold color={chartColor} underline>{formatRupiah(priceIDR)}</Text>

                    <Box height={chartHeight} marginY={1}>
                        <CandlestickChart data={sChart} height={chartHeight} />
                    </Box>

                    <Box borderStyle="single" borderColor="gray" padding={0} flexDirection="column">
                        <Box justifyContent="space-between" paddingX={1}>
                            <Text dimColor>24h Range:</Text>
                            <Text>
                                <Text color="green">{formatCompact((sData.high || 0) * usdrate)}</Text>
                                {' - '}
                                <Text color="red">{formatCompact((sData.low || 0) * usdrate)}</Text>
                            </Text>
                        </Box>
                        <Box borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} borderColor="gray" paddingX={1} justifyContent="space-between">
                            <Text bold color="cyan">RSI: {sRSI.toFixed(1)}</Text>
                            <Text bold color={signalColor}>{signal}</Text>
                        </Box>
                    </Box>
                </Box>
            </Box>

            <Box paddingX={1} justifyContent="space-between" backgroundColor="#111111">
                <Text color="green" bold>[B] {ICONS.BUY} Buy</Text>
                <Text color="red" bold>[S] {ICONS.SELL} Sell</Text>
                <Text color="yellow" bold>[P] {ICONS.PORTFOLIO} Portfolio</Text>
                <Text color="cyan" bold>[M] {ICONS.MARKET} Market</Text>
                <Text color="red" bold>[Q] {ICONS.EXIT} Exit</Text>
            </Box>
        </Box>
    );
};

// --- PORTFOLIO ---
const PortfolioScreen = ({ balance, holdings, prices, usdrate, onBack, onExit }) => {
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

    useInput((input, key) => {
        if (input === 'p' || input === 'P' || key.escape) onBack();
        if (input === 'q' || input === 'Q') onExit();
    });

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
            <Text bold color="black" backgroundColor="yellow"> {ICONS.PORTFOLIO} PORTFOLIO SUMMARY </Text>
            <Box marginY={1} borderStyle="double" borderColor={isProfitable ? "green" : "red"} padding={1} flexDirection="column">
                <Text>Net Worth: <Text bold color="cyan">{formatRupiah(totalVal)}</Text></Text>
                <Text>Cash Balance: <Text bold color="white">{formatRupiah(balance)}</Text></Text>
                <Text>Total P&L: <Text bold color={isProfitable ? "greenBright" : "redBright"}>{isProfitable ? ICONS.UP : ICONS.DOWN} {formatRupiah(pnl)} ({isProfitable ? '+' : ''}{pnlPercent}%)</Text></Text>
            </Box>
            <Text bold color="yellow" underline>Holdings:</Text>
            <Box flexDirection="column" marginTop={1}>
                {items.length === 0 ? <Text dimColor>{ICONS.INFO} No assets yet. Start trading!</Text> : items.map((i, k) => (
                    <Box key={k} justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text bold color="yellow">{ICONS.BULLET} {i.name}</Text>
                        <Text color="white">{formatNum(i.qty)}</Text>
                        <Text color="cyan">{formatCompact(i.val)}</Text>
                    </Box>
                ))}
            </Box>
            <Spacer />
            <Box justifyContent="space-between">
                <Text color="cyan" bold marginTop={1}>[P] Back to Simulation</Text>
                <Text color="red" bold marginTop={1}>[Q] {ICONS.EXIT} Exit</Text>
            </Box>
        </Box>
    );
};

// --- NEWS SCREEN ---
const NewsScreen = ({ onBack, onExit }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await axios.get('https://api.coingecko.com/api/v3/search/trending');
                const items = res.data.coins.slice(0, 10).map(item => ({
                    title: `${item.item.name} (${item.item.symbol}) - Rank #${item.item.market_cap_rank || 'N/A'}`,
                    subtitle: `Score: ${item.item.score}`,
                    icon: item.item.score > 3 ? ICONS.TRENDING : ICONS.UP
                }));
                setNews(items);
            } catch (e) {
                setNews([{ title: "Failed to load news", subtitle: "Check connection", icon: ICONS.ERROR }]);
            }
            setLoading(false);
        };
        fetchNews();

        const interval = setInterval(fetchNews, 300000);
        return () => clearInterval(interval);
    }, []);

    useInput((input, key) => {
        if (input === 'n' || input === 'N' || key.escape) onBack();
        if (input === 'q' || input === 'Q') onExit();
    });

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
            <Text bold color="black" backgroundColor="magenta"> {ICONS.NEWS} CRYPTO NEWS & TRENDING </Text>
            <Box marginY={1} flexDirection="column">
                {loading ? <Text color="yellow">{ICONS.LOADING} Loading news...</Text> : news.map((n, i) => (
                    <Box key={i} borderStyle="single" borderColor="gray" paddingX={1} marginY={0} flexDirection="column">
                        <Text color="magentaBright">{n.icon} {n.title}</Text>
                        <Text dimColor>{n.subtitle}</Text>
                    </Box>
                ))}
            </Box>
            <Spacer />
            <Text dimColor>Auto-refresh every 5 minutes</Text>
            <Box justifyContent="space-between">
                <Text color="cyan" bold>[N] Back to Market</Text>
                <Text color="red" bold>[Q] {ICONS.EXIT} Exit</Text>
            </Box>
        </Box>
    );
};

// --- EDUCATION SCREEN ---
const EducationScreen = ({ onBack, onExit }) => {
    const [topicIdx, setTopicIdx] = useState(0);

    const topics = [
        {
            title: `${ICONS.INFO} What is Cryptocurrency?`,
            content: [
                "Cryptocurrency adalah mata uang digital yang menggunakan kriptografi",
                "untuk keamanan transaksi. Berbeda dengan mata uang tradisional,",
                "crypto beroperasi secara terdesentralisasi menggunakan teknologi",
                "blockchain. Bitcoin adalah cryptocurrency pertama (2009).",
                "",
                "Keuntungan: Transaksi cepat, biaya rendah, borderless",
                "Risiko: Volatilitas tinggi, belum diatur di semua negara"
            ]
        },
        {
            title: `${ICONS.MARKET} Technical Indicators`,
            content: [
                "RSI (Relative Strength Index):",
                `${ICONS.BULLET} Range: 0-100`,
                `${ICONS.BULLET} > 70 = Overbought (mungkin akan turun)`,
                `${ICONS.BULLET} < 30 = Oversold (mungkin akan naik)`,
                "",
                "Support & Resistance:",
                `${ICONS.BULLET} Support: Level harga di mana buying pressure kuat`,
                `${ICONS.BULLET} Resistance: Level harga di mana selling pressure kuat`,
                "",
                "Moving Averages: Rata-rata harga dalam periode tertentu"
            ]
        },
        {
            title: `${ICONS.WARNING} Risk Management`,
            content: [
                "ATURAN EMAS:",
                "1. Jangan invest lebih dari yang bisa Anda rugikan",
                "2. Diversifikasi - jangan all-in di satu coin",
                "3. Set stop-loss untuk batasi kerugian",
                "4. DYOR (Do Your Own Research)",
                "5. Jangan FOMO (Fear Of Missing Out)",
                "",
                "Ingat: Crypto sangat volatile. Harga bisa naik/turun drastis.",
                "Gunakan mode SIMULATION untuk belajar dulu!"
            ]
        },
        {
            title: `${ICONS.EDUCATION} Common Terms`,
            content: [
                "HODL: Hold On for Dear Life (tahan investasi jangka panjang)",
                "FOMO: Fear Of Missing Out (takut ketinggalan)",
                "FUD: Fear, Uncertainty, Doubt (berita negatif)",
                "ATH: All-Time High (harga tertinggi sepanjang masa)",
                "ATL: All-Time Low (harga terendah sepanjang masa)",
                "Whale: Investor dengan jumlah crypto sangat besar",
                "Bull Market: Pasar naik",
                "Bear Market: Pasar turun",
                "Satoshi: Unit terkecil Bitcoin (0.00000001 BTC)"
            ]
        }
    ];

    useInput((input, key) => {
        if (input === 'e' || input === 'E' || key.escape) onBack();
        if (input === 'q' || input === 'Q') onExit();
        if (key.leftArrow) setTopicIdx(p => Math.max(0, p - 1));
        if (key.rightArrow) setTopicIdx(p => Math.min(topics.length - 1, p + 1));
    });

    const topic = topics[topicIdx];

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
            <Text bold color="black" backgroundColor="cyan"> {ICONS.EDUCATION} CRYPTO EDUCATION </Text>
            <Box marginY={1} justifyContent="center">
                <Text bold color="cyan">{topic.title}</Text>
            </Box>
            <Box borderStyle="single" borderColor="gray" padding={1} flexDirection="column" minHeight={15}>
                {topic.content.map((line, i) => (
                    <Text key={i} color={line.startsWith(ICONS.BULLET) || line.startsWith('ATURAN') ? "yellow" : "white"}>{line}</Text>
                ))}
            </Box>
            <Box marginTop={1} justifyContent="space-between">
                <Text dimColor>[{ICONS.ARROW}] Previous</Text>
                <Text color="cyan" bold>Topic {topicIdx + 1} of {topics.length}</Text>
                <Text dimColor>[{ICONS.ARROW}] Next</Text>
            </Box>
            <Box marginTop={1} justifyContent="space-between">
                <Text color="cyan" bold>[E] Back to Market</Text>
                <Text color="red" bold>[Q] {ICONS.EXIT} Exit</Text>
            </Box>
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
    const [wsStatus, setWsStatus] = useState(false);

    const [balance, setBalance] = useState(STARTING_BALANCE_IDR);
    const [holdings, setHoldings] = useState({});
    const chartsRef = useRef({});
    const wsRef = useRef(null);

    // PROPER EXIT HANDLER - USE process.exit()
    const handleExit = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        process.exit(0);
    };

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

                setPrices(p => ({
                    ...p, [s]: {
                        price,
                        change: parseFloat(data.P),
                        high: parseFloat(data.h),
                        low: parseFloat(data.l)
                    }
                }));

                const curChart = chartsRef.current[s] || [];
                let newChart;

                if (curChart.length === 0) {
                    newChart = [price];
                } else if (curChart.length < 50) {
                    newChart = [...curChart, price];
                } else {
                    newChart = [...curChart.slice(1), price];
                }

                chartsRef.current[s] = newChart;
                setCharts(prev => ({ ...prev, [s]: newChart }));
                setRsiData(prev => ({ ...prev, [s]: calculateRSI(newChart) }));
            });

            ws.on('error', () => {
                setWsStatus(false);
            });

            ws.on('close', () => {
                setWsStatus(false);
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

            histRes.data.forEach(c => {
                const cfg = coinsToFetch.find(x => x.id === c.id);
                if (cfg) {
                    const hist = c.sparkline_in_7d.price.filter(p => p > 0).slice(-50);
                    chartsRef.current[cfg.symbol] = hist;
                    setCharts(prev => ({ ...prev, [cfg.symbol]: hist }));
                    setPrices(prev => ({
                        ...prev, [cfg.symbol]: {
                            price: c.current_price,
                            change: c.price_change_percentage_24h,
                            high: c.high_24h,
                            low: c.low_24h
                        }
                    }));
                    setRsiData(prev => ({ ...prev, [cfg.symbol]: calculateRSI(hist) }));
                }
            });
        } catch (e) { }
    };

    useEffect(() => {
        const init = async () => {
            await fetchData(watchlist);
            connectWS(watchlist);
            setLoading(false);
        };
        init();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    const handleAddCoin = async (newCoin) => {
        if (watchlist.find(c => c.id === newCoin.id)) { setView('market'); return; }

        // Map coin ID to Binance symbol if available
        const binanceSymbol = BINANCE_SYMBOL_MAP[newCoin.id] || (newCoin.symbol.replace('usdt', '') + 'usdt');
        const coinWithSymbol = { ...newCoin, symbol: binanceSymbol };

        const updatedList = [...watchlist, coinWithSymbol];
        setLoading(true); setView('market');

        // CRITICAL: Close old WebSocket FIRST
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Initialize with empty chart array first
        chartsRef.current[binanceSymbol] = [];
        setCharts(prev => ({ ...prev, [binanceSymbol]: [] }));

        // Fetch historical data
        await fetchData([coinWithSymbol]);

        // Update watchlist AFTER data ready
        setWatchlist(updatedList);

        // Reconnect WebSocket with updated list
        connectWS(updatedList);

        setSelIdx(updatedList.length - 1);
        setLoading(false);
    };

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
        setView('simulation');
    };

    const changeIndex = (delta) => {
        setSelIdx(prev => {
            if (delta < 0) return prev > 0 ? prev - 1 : watchlist.length - 1;
            else return prev < watchlist.length - 1 ? prev + 1 : 0;
        });
    };

    useInput((input, key) => {
        if (booting || view === 'search' || view.startsWith('trade')) return;

        if (view === 'market' && (input === 's' || input === 'S')) setView('simulation');
        if (view === 'simulation' && (input === 'm' || input === 'M')) setView('market');
        if (input === 'n' || input === 'N') setView('news');
        if (input === 'e' || input === 'E') setView('education');
    });

    if (booting) return <BootScreen onBootComplete={() => setBooting(false)} />;
    if (view === 'search') return <SearchModal onSelect={handleAddCoin} onCancel={() => setView('market')} />;

    if (view.startsWith('trade')) {
        const coin = watchlist[selIdx];
        const p = (prices[coin.symbol]?.price || 0) * usdrate;
        const hold = holdings[coin.symbol] || 0;
        return <TradeModal
            type={view === 'trade_buy' ? 'BUY' : 'SELL'}
            coin={coin}
            price={p}
            balance={balance}
            holding={hold}
            onConfirm={(v) => executeTrade(view === 'trade_buy' ? 'BUY' : 'SELL', v)}
            onCancel={() => setView('simulation')}
        />;
    }

    if (view === 'portfolio') return <PortfolioScreen balance={balance} holdings={holdings} prices={prices} usdrate={usdrate} onBack={() => setView('simulation')} onExit={handleExit} />;
    if (view === 'news') return <NewsScreen onBack={() => setView('market')} onExit={handleExit} />;
    if (view === 'education') return <EducationScreen onBack={() => setView('market')} onExit={handleExit} />;

    if (view === 'simulation') {
        return <SimulationDashboard
            prices={prices}
            charts={charts}
            loading={loading}
            selectedIndex={selIdx}
            usdrate={usdrate}
            balance={balance}
            rsiData={rsiData}
            watchlist={watchlist}
            wsStatus={wsStatus}
            onOpenTrade={(type) => setView(type === 'BUY' ? 'trade_buy' : 'trade_sell')}
            onChangeIndex={changeIndex}
            onExit={handleExit}
        />;
    }

    return <BloombergMarketDashboard
        prices={prices}
        charts={charts}
        loading={loading}
        selectedIndex={selIdx}
        usdrate={usdrate}
        rsiData={rsiData}
        watchlist={watchlist}
        wsStatus={wsStatus}
        onOpenSearch={() => setView('search')}
        onChangeIndex={changeIndex}
        onExit={handleExit}
    />;
};

render(<App />);
