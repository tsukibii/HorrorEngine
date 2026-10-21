# The PBR shelf

Your texture sets, one folder each, in category folders (categories can nest):

    Wood/old_planks/old_planks_diff_2k.jpg, _ao_2k.jpg, _disp_2k.png, _nor_dx_2k.png, _rough_2k.jpg
    Stone/Walls/rough_brick_2k.zip      a ZIP dropped in is unpacked into rough_brick/ on the next scan

Scan with `python tools/pbr.py` or by opening the shelf page (http://127.0.0.1:8780/pbr.html). A set's ref is
`pbr/<category>/<name>`: a room's look or a prop's mat. Everything here but this file is git-ignored (the sets are
big, and your own). `$STUDIO_PBR` puts the shelf somewhere else. docs/ASSETS.md §6.
