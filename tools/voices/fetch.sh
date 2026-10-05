#!/bin/bash
# Downloads the voice toolchain into this cache folder. Safe to re-run.
set -e
cd "$(dirname "$0")" && mkdir -p .cache && cd .cache
get() { [ -s "$2" ] || curl -sSL --retry 3 -C - -o "$2.part" "$1" && { [ -s "$2" ] || mv "$2.part" "$2"; }; }
get https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip piper.zip
get https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-shared-8.1.zip ffmpeg.zip
[ -d piper ] || unzip -q piper.zip -d .
[ -d ffmpeg ] || { unzip -q ffmpeg.zip -d ffx && mv ffx/* ffmpeg && rmdir ffx; }
mkdir -p models
for v in es_MX-ald-medium es_ES-davefx-medium es_AR-daniela-high es_MX-claude-high es_ES-sharvard-medium \
         en_US-bryce-medium en_US-norman-medium en_GB-cori-high en_US-sam-medium en_US-joe-medium; do
  lang=${v%%_*}; rest=${v#*-}; region=${v%%-*}; name=${rest%-*}; q=${rest##*-}
  base="https://huggingface.co/rhasspy/piper-voices/resolve/main/$lang/$region/$name/$q/$v"
  get "$base.onnx" "models/$v.onnx"
  get "$base.onnx.json" "models/$v.onnx.json"
  echo "ok $v"
done
echo ALLDONE
