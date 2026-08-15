#!/usr/bin/env bash
# One-shot setup for a fresh Raspberry Pi. Run from the project directory:
#   bash scripts/install.sh
set -euo pipefail

echo "==> Installing system packages (camera + OpenCV runtime deps)"
sudo apt-get update
sudo apt-get install -y python3-pip python3-picamera2 libatlas-base-dev

echo "==> Installing Python dependencies"
pip3 install --user -r requirements.txt

echo "==> Creating your config from the examples (if not present)"
[ -f config.yaml ]   || cp config.example.yaml config.yaml
[ -f chickens.yaml ] || cp chickens.example.yaml chickens.yaml

cat <<'NEXT'

Done. Next steps:
  1. python3 calibrate.py snapshot --out coop.jpg
     Copy coop.jpg to your computer and note each nesting box's pixel corners.
  2. Edit config.yaml   -> set the three `zones` rectangles.
  3. python3 calibrate.py sample-band --image coop.jpg --rect X Y W H
     Run once per hen over her leg band; paste the output into chickens.yaml.
  4. Test:  python3 run.py --verbose
  5. Install as services (auto-start on boot):
       sudo cp systemd/*.service /etc/systemd/system/
       sudo systemctl daemon-reload
       sudo systemctl enable --now chicken-tracker chicken-dashboard
  6. Open the dashboard at http://<pi-address>:8080
NEXT
