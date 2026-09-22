#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/Artboard_Resizer"
EXTENSIONS_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
DESTINATION="$EXTENSIONS_DIR/com.eduardonoe.artboardresizer"

if [[ ! -d "$SOURCE" ]]; then
    echo "Installation failed: the Artboard_Resizer folder is missing."
    echo "Extract the complete ZIP and keep the folder beside this installer."
    read -r -n 1 -s -p "Press any key to close..."
    exit 1
fi

mkdir -p "$EXTENSIONS_DIR"

if [[ -e "$DESTINATION" ]]; then
    BACKUP="${DESTINATION}.backup-$(date +%Y%m%d%H%M%S)"
    mv "$DESTINATION" "$BACKUP"
fi

mkdir -p "$DESTINATION"
ditto "$SOURCE" "$DESTINATION"

for version in 9 10 11 12 13; do
    defaults write "com.adobe.CSXS.${version}" PlayerDebugMode -string "1"
done

echo
echo "Artboard Resizer was installed successfully."
echo "Restart Adobe Illustrator, then open:"
echo "Window > Extensions (Legacy) > Artboard Resizer"
echo
read -r -n 1 -s -p "Press any key to close..."
