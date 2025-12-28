#!/bin/bash

# Judul
echo -e "\033[1;36m"
echo "========================================"
echo "   🚀 LAUNCHING NEXUS TRADER X PRO"
echo "========================================"
echo -e "\033[0m"

# 1. Cek apakah node_modules ada? Kalau gak ada, install dulu.
if [ ! -d "node_modules" ]; then
    echo -e "\033[1;33m📦 Mendeteksi instalasi pertama... Menginstall modules...\033[0m"
    npm install ink react axios asciichart ws
    npm install --save-dev tsx
    echo -e "\033[1;32m✅ Instalasi Selesai!\033[0m"
else
    echo -e "\033[1;32m✅ System Ready.\033[0m"
fi

# 2. Jalankan Aplikasi
echo -e "\033[1;35m⚡ Memulai Sistem...\033[0m"
sleep 1
npx tsx index.jsx
