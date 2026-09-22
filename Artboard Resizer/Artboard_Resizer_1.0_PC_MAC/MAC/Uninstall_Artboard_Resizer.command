#!/bin/bash
set -euo pipefail

DESTINATION="$HOME/Library/Application Support/Adobe/CEP/extensions/com.eduardonoe.artboardresizer"

if [[ -e "$DESTINATION" ]]; then
    BACKUP="${DESTINATION}.removed-$(date +%Y%m%d%H%M%S)"
    mv "$DESTINATION" "$BACKUP"
    echo "Artboard Resizer was removed to: $BACKUP"
else
    echo "Artboard Resizer is not installed for this user."
fi

echo
echo "Restart Adobe Illustrator to finish."
read -r -n 1 -s -p "Press any key to close..."
