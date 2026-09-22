ARTBOARD RESIZER 2.7.0
======================

This package has separate installers for Windows and macOS.

PC (WINDOWS)
------------
1. Extract the ZIP completely.
2. Close Adobe Illustrator.
3. Open the PC folder.
4. Run Install_Artboard_Resizer.bat.
5. Restart Illustrator.
6. Open Window > Extensions (Legacy) > Artboard Resizer.

MAC (macOS)
-----------
1. Extract the ZIP completely.
2. Close Adobe Illustrator.
3. Open the MAC folder.
4. Right-click Install_Artboard_Resizer.command and choose Open.
5. Confirm macOS security prompts, if shown.
6. Restart Illustrator.
7. Open Window > Extensions (Legacy) > Artboard Resizer.

If macOS blocks the installer, open Terminal and run this command after
replacing the path with the extracted MAC folder:

xattr -dr com.apple.quarantine "/path/to/MAC"

Then run Install_Artboard_Resizer.command again.

NOTES
-----
- The installers enable Adobe CEP PlayerDebugMode for the supported CSXS versions.
- The panel is compatible with Adobe Illustrator 2019 and later.
- The Range scope accepts values such as: 1-5, 8, 12-15.
- A range containing more than one artboard generates a new AI document with
  only the selected, resized artboards. The original is preserved.
- When the selected artboards do not fit on one regular Illustrator canvas,
  the output is split across several AI files automatically.
- Envelope Distort objects are expanded into paths in the output file. An
  envelope's mesh does not survive the save otherwise, which used to make
  warped ribbons come back at their original size. The source file is never
  modified, so the live envelope stays editable there.
- Each generated file gets a matching _debug.txt listing what happened to
  every item.
