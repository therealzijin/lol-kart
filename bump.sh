#!/bin/sh
# 部署前執行：替所有模組 import 加上新版本號，避免手機混用快取中的舊檔
V=$(date +%Y%m%d%H%M%S)
sed -i '' -E "s#(from '\./[a-z0-9]+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g; s#(import\('\./[a-z0-9]+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g; s#^(import \* as [A-Za-z]+ from '\./[a-z0-9]+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g" src/*.js
sed -i '' -E "s#src/main\.js(\?v=[0-9a-z]+)?\"#src/main.js?v=$V\"#" index.html
echo "version $V"
