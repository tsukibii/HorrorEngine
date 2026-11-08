# The retro pack, model by model

Made by `python tools/propgen.py quality audit` (docs/PROPGEN.md §29) from `Content/Studio/Props/retro_audit.json`:
each file's nearest LOD measured and judged, the review by eye (`retro_review.json`), its recipes and their gaps
against the bar (`quality_reference.json`, fifteen of the best made props) as the file came and as made (where
made on this machine). A gap is a measure outside the bar's 10th to 90th percentile.

**168 pass, 1 fail** of 169 files (the poles' LOD1 and LOD2 files judged beside their LOD0).

## Camp

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Props/Camp/Bag.glb | 444 | 0.25 x 0.25 x 0.43 | pass | retro_bag | 8 -> 2 |  |
| Props/Camp/Bonfire.glb | 2668 | 0.92 x 0.93 x 0.37 | pass | retro_bonfire | 8 -> 5 | 16 open edges (cards or a shell): drawn from both sides |
| Props/Camp/Cooker.glb | 1426 | 0.26 x 0.26 x 0.28 | pass | retro_cooker | 8 -> 1 | its cartridge carries INMETRO's mark (Brazil's real certification mark) beside the made-up TEK GAS and MUTUM: swap the mark before a game ships |
| Props/Camp/IceBox.glb | 440 | 0.52 x 0.31 x 0.37 | pass | retro_icebox | 8 -> 3 |  |
| Props/Camp/IceBox_Cover.glb | 188 | 0.50 x 0.30 x 0.07 | pass | retro_icebox_lid | 6 -> 1 |  |
| Props/Camp/Lantern.glb | 378 | 0.28 x 0.15 x 0.17 | pass | retro_lantern | 8 -> 2 | 4 open edges (cards or a shell): drawn from both sides |
| Props/Camp/Pan_A.glb | 608 | 0.31 x 0.21 x 0.21 | pass | retro_pan | 6 -> 1 |  |
| Props/Camp/Pan_B.glb | 608 | 0.31 x 0.21 x 0.11 | pass | retro_pan_low | 7 -> 2 |  |
| Props/Camp/SleepingBag.glb | 200 | 2.00 x 0.80 x 0.11 | pass | retro_sleeping_bag | 7 -> 1 | 5 open edges (cards or a shell): drawn from both sides |
| Props/Camp/Tent.glb | 399 | 2.16 x 2.16 x 1.53 | pass | retro_tent | 8 -> 2 | 25 open edges (cards or a shell): drawn from both sides |
| Props/Camp/ThermalBottle.glb | 380 | 0.06 x 0.06 x 0.20 | pass | retro_thermal_bottle | 7 -> 1 |  |

## Gas station

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Props/Gas_Station/FireExtinguisher.glb | 1130 | 0.27 x 0.21 x 0.81 | pass | retro_fire_extinguisher | 9 -> 2 | 24 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Flag_Black.glb | 5 | 0.34 x 0.00 x 0.40 | pass | retro_pennant_black | 8 -> 2 | 7 open edges (cards or a shell): drawn from both sides; shares its texture with Light_Sign (Shell's V-Power), though the flag itself shows only a plain colour |
| Props/Gas_Station/Flag_Red.glb | 5 | 0.34 x 0.00 x 0.40 | pass | retro_pennant_red | 8 -> 2 | 7 open edges (cards or a shell): drawn from both sides; shares its texture with Light_Sign (Shell's V-Power), though the flag itself shows only a plain colour |
| Props/Gas_Station/Flag_Yellow.glb | 5 | 0.34 x 0.00 x 0.40 | pass | retro_pennant_yellow | 8 -> 3 | 7 open edges (cards or a shell): drawn from both sides; shares its texture with Light_Sign (Shell's V-Power), though the flag itself shows only a plain colour |
| Props/Gas_Station/Gas _Pump_Handler.glb | 1188 | 0.05 x 0.26 x 0.38 | pass | retro_pump_nozzle | 7 -> 1 |  |
| Props/Gas_Station/GasRoof_0.glb | 26 | 2.00 x 2.00 x 0.88 | pass | retro_canopy_0 | 6 -> 1 | 30 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_1.glb | 36 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_1 | 6 -> 1 | 42 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_2.glb | 46 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_2 | 6 -> 1 | 44 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_3.glb | 46 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_3 | 6 -> 1 | 44 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_4.glb | 36 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_4 | 6 -> 1 | 42 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_5.glb | 36 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_5 | 6 -> 1 | 42 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_6.glb | 46 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_6 | 6 -> 1 | 44 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_7.glb | 36 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_7 | 6 -> 1 | 42 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/GasRoof_8.glb | 46 | 2.00 x 2.00 x 1.00 | pass | retro_canopy_8 | 6 -> 1 | 44 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Gas_Guard_rail.glb | 348 | 0.68 x 0.09 x 1.00 | pass | retro_bollard | 6 -> 0 |  |
| Props/Gas_Station/Gas_Pilar.glb | 112 | 0.76 x 0.69 x 6.00 | pass | retro_canopy_column | 6 -> 1 |  |
| Props/Gas_Station/Gas_Pump.glb | 8444 | 1.22 x 1.01 x 2.50 | pass | retro_fuel_pump | 15 -> 6 | 8444 triangles, over a low-poly budget of 6000 for its size; 480 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Gas_Pump_Base.glb | 3052 | 1.08 x 0.80 x 2.50 | pass | retro_fuel_pump_body | 8 -> 3 | 448 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Lamp_01.glb | 44 | 0.62 x 0.62 x 0.25 | pass | retro_light_panel | 8 -> 2 |  |
| Props/Gas_Station/Lamp_02.glb | 292 | 0.31 x 1.42 x 0.07 | pass | retro_tube_light | 9 -> 4 |  |
| Props/Gas_Station/Lamp_03.glb | 626 | 0.24 x 0.20 x 0.23 | pass | retro_wall_lamp | 7 -> 1 | 24 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Light_Sign.glb | 72 | 2.18 x 0.68 x 1.40 | pass | retro_light_sign | 6 -> 3 | its texture says V-Power Racing: Shell's fuel brand (a trademark). Swap the words before a game ships |
| Props/Gas_Station/Number_Sign.glb | 216 | 0.88 x 0.32 x 0.40 | pass | retro_price_sign | 6 -> 0 | shares its texture with Light_Sign (Shell's V-Power) |
| Props/Gas_Station/Pavement_0.glb | 2 | 1.00 x 1.00 x 0.00 | pass | retro_pavement_0 | 6 -> 2 | 4 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_1.glb | 28 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_1 | 6 -> 2 | 14 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_10.glb | 30 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_10 | 6 -> 2 | 16 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_11.glb | 30 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_11 | 6 -> 2 | 16 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_12.glb | 30 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_12 | 6 -> 2 | 16 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_2.glb | 10 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_2 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_3.glb | 28 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_3 | 6 -> 2 | 14 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_4.glb | 10 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_4 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_5.glb | 10 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_5 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_6.glb | 28 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_6 | 6 -> 2 | 14 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_7.glb | 10 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_7 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_8.glb | 28 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_8 | 6 -> 2 | 14 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Pavement_9.glb | 30 | 1.00 x 1.00 x 0.21 | pass | retro_pavement_9 | 6 -> 2 | 16 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Sign_01.glb | 12 | 0.45 x 0.01 x 0.63 | pass | retro_poster_01 | 9 -> 2 | a real public-health campaign poster (Brazil's vaccination campaign): someone else's artwork, swap it before a game ships |
| Props/Gas_Station/Sign_02.glb | 12 | 0.45 x 0.01 x 0.63 | pass | retro_poster_02 | 9 -> 1 | a real public-health campaign poster (a dogs and cats vaccination campaign): someone else's artwork, swap it before a game ships |
| Props/Gas_Station/Sign_03.glb | 12 | 0.45 x 0.01 x 0.44 | pass | retro_poster_03 | 9 -> 2 | a real public-health campaign poster (a meningitis vaccination campaign): someone else's artwork, swap it before a game ships |
| Props/Gas_Station/Sign_04.glb | 12 | 0.45 x 0.01 x 0.88 | pass | retro_poster_04 | 9 -> 1 |  |
| Props/Gas_Station/Sign_05.glb | 12 | 0.32 x 0.01 x 0.22 | pass | retro_poster_05 | 8 -> 2 |  |
| Props/Gas_Station/Sign_06.glb | 12 | 0.32 x 0.01 x 0.31 | pass | retro_poster_06 | 9 -> 2 |  |
| Props/Gas_Station/Sign_07.glb | 60 | 0.38 x 0.00 x 0.38 | pass | retro_poster_07 | 9 -> 2 |  |
| Props/Gas_Station/Trash_Bag.glb | 256 | 0.64 x 0.65 x 0.50 | pass | retro_trash_bag | 8 -> 4 | 32 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Station/Trash_Box.glb | 312 | 0.63 x 0.95 x 1.00 | pass | retro_bin_station | 7 -> 2 |  |
| Props/Gas_Station/Trash_Can.glb | 28 | 0.50 x 0.50 x 0.50 | pass | retro_bin_blue | 6 -> 3 |  |

## Gas store

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Props/Gas_Store/Door_A.glb | 510 | 1.00 x 0.18 x 2.10 | pass | retro_door_a | 9 -> 11 | 24 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Door_B.glb | 510 | 1.00 x 0.18 x 2.10 | pass | retro_door_b | 9 -> 11 | 24 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Roof_Base_Center.glb | 54 | 2.00 x 2.20 x 2.20 | pass | retro_roof_base_center | 7 -> 3 | 7 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Roof_Base_Corner.glb | 154 | 2.20 x 2.20 x 2.20 | pass | retro_roof_base_corner | 7 -> 3 | 11 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Roof_Center.glb | 12 | 2.00 x 2.00 x 2.20 | pass | retro_roof_center | 7 -> 3 |  |
| Props/Gas_Store/Roof_Corner.glb | 12 | 2.00 x 2.00 x 2.20 | pass | retro_roof_corner | 7 -> 3 |  |
| Props/Gas_Store/Roof_Floor.glb | 2 | 2.00 x 2.00 x 0.00 | pass | retro_roof_floor | 6 -> 2 | 4 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Roof_Top.glb | 2 | 2.00 x 2.00 x 0.00 | pass | retro_roof_top | 7 -> 3 | 4 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Wall_2x3_A.glb | 60 | 2.00 x 0.30 x 3.00 | pass | retro_wall_2x3_a | 6 -> 2 |  |
| Props/Gas_Store/Wall_4x3_A.glb | 320 | 4.00 x 0.30 x 3.00 | pass | retro_wall_4x3_a | 6 -> 2 |  |
| Props/Gas_Store/Wall_4x3_B.glb | 564 | 4.00 x 0.30 x 3.00 | pass | retro_wall_4x3_b | 6 -> 2 | 10 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Wall_Pillar.glb | 12 | 0.32 x 0.32 x 3.00 | pass | retro_wall_pillar | 6 -> 2 |  |
| Props/Gas_Store/Window_4x3_A.glb | 394 | 1.80 x 0.06 x 1.60 | pass | retro_window_a | 9 -> 12 | smooth-shaded over 60-degree facets: smoothed by angle instead; 4 open edges (cards or a shell): drawn from both sides |
| Props/Gas_Store/Window_4x3_B.glb | 558 | 3.80 x 0.06 x 1.80 | pass | retro_window_b | 9 -> 12 | smooth-shaded over 60-degree facets: smoothed by angle instead; 16 open edges (cards or a shell): drawn from both sides |

## Plants

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Vegetation/Vegetation/Bush_A/Bush_A.glb | 64 | 1.97 x 1.87 x 1.24 | pass | retro_bush_a | 6 -> 1 | 64 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Bush_A/Bush_C.glb | 80 | 2.99 x 2.53 x 1.30 | pass | retro_bush_c | 7 -> 2 | 80 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Bush_A/Bush_D.glb | 96 | 2.43 x 2.34 x 1.72 | pass | retro_bush_d | 7 -> 2 | 96 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Bush_A/Bush_E.glb | 72 | 2.05 x 2.09 x 1.36 | pass | retro_bush_e | 7 -> 2 | 72 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Bush_A/Bush_F.glb | 24 | 2.44 x 2.22 x 1.41 | pass | retro_bush_f | 6 -> 1 | 42 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Bush_A/Bush_b.glb | 152 | 2.99 x 2.61 x 1.43 | pass | retro_bush_b | 7 -> 2 | 152 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Grass_A/Grass_A.glb | 20 | 1.25 x 1.26 x 0.54 | pass | retro_grass_a | 7 -> 2 | 30 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Grass_A/Grass_B.glb | 24 | 1.32 x 1.24 x 0.60 | pass | retro_grass_b | 7 -> 1 | 36 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Grass_A/Grass_C.glb | 34 | 1.26 x 1.35 x 0.64 | pass | retro_grass_c | 7 -> 2 | 54 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Grass_A/Grass_D.glb | 28 | 0.97 x 0.97 x 0.40 | pass | retro_grass_d | 7 -> 2 | 42 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Grass_A/Grass_E.glb | 14 | 1.01 x 0.98 x 0.46 | pass | retro_grass_e | 7 -> 2 | 28 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/Senacio_A.glb | 79 | 0.90 x 0.95 x 1.16 | pass | retro_senecio | 4 -> 2 | 5 faces wound against their own normals (6.3%): wound back; 95 open edges (cards or a shell): drawn from both sides |
| Vegetation/Vegetation/WhiteClover_A.glb | 270 | 0.94 x 0.91 x 0.54 | pass | retro_clover_a | 4 -> 1 | 11 faces wound against their own normals (4.1%): wound back; 450 open edges (cards or a shell): drawn from both sides; 54 cm tall for white clover (a real patch stands 10 to 30 cm): scale it down when placing if it reads too big |
| Vegetation/Vegetation/WhiteClover_B.glb | 135 | 1.32 x 1.31 x 0.27 | pass | retro_clover_b | 4 -> 1 | 11 faces wound against their own normals (8.1%): wound back; 245 open edges (cards or a shell): drawn from both sides; a patch 1.3 m across: scale it down when placing if it reads too big |

## Road

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Roads/Guardrail.glb | 404 | 2.00 x 0.18 x 0.70 | pass | retro_guardrail | 6 -> 2 |  |
| Roads/Road_01.glb | 18 | 10.00 x 10.00 x 0.20 | pass | retro_road_01 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Roads/Road_02.glb | 18 | 10.00 x 10.00 x 0.20 | pass | retro_road_02 | 7 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Roads/Road_04.glb | 18 | 10.00 x 10.00 x 0.20 | pass | retro_road_04 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Roads/Road_05.glb | 18 | 10.00 x 10.00 x 0.20 | pass | retro_road_05 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Roads/Road_06.glb | 18 | 10.00 x 10.00 x 0.20 | pass | retro_road_06 | 6 -> 2 | 12 open edges (cards or a shell): drawn from both sides |
| Roads/Sign_01.glb | 40 | 0.71 x 0.05 x 2.15 | pass | retro_road_sign_01 | 7 -> 5 |  |
| Roads/Sign_02.glb | 72 | 0.42 x 0.05 x 2.10 | pass | retro_road_sign_02 | 8 -> 5 |  |
| Roads/Sign_03.glb | 56 | 0.31 x 0.04 x 1.26 | pass | retro_road_sign_03 | 7 -> 3 |  |
| Roads/Sign_04.glb | 112 | 0.60 x 0.04 x 2.10 | pass | retro_road_sign_04 | 8 -> 5 | 16 open edges (cards or a shell): drawn from both sides |
| Roads/Sign_05.glb | 60 | 0.75 x 0.05 x 2.14 | pass | retro_road_sign_05 | 8 -> 6 |  |
| Roads/Sign_06.glb | 60 | 0.75 x 0.05 x 2.12 | pass | retro_road_sign_06 | 6 -> 5 |  |
| Roads/Sign_07.glb | 56 | 0.56 x 0.04 x 1.10 | pass | retro_road_sign_07 | 7 -> 4 |  |
| Roads/Sign_08.glb | 100 | 0.80 x 0.05 x 1.66 | pass | retro_road_sign_08 | 7 -> 3 |  |
| Roads/Sign_09.glb | 100 | 1.35 x 0.05 x 1.99 | pass | retro_road_sign_09 | 7 -> 4 |  |
| Roads/Tower_01.glb | 4456 | 25.30 x 7.85 x 40.15 | pass | retro_pylon | 6 -> 4 | 348 faces wound against their own normals (7.8%): wound back |

## Rocks

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Rocks/RockB_01.glb | 152 | 6.49 x 6.81 x 5.08 | pass | retro_boulder_b1 | 6 -> 3 |  |
| Rocks/RockB_02.glb | 142 | 8.05 x 5.76 x 3.99 | pass | retro_boulder_b2 | 6 -> 3 |  |
| Rocks/RockB_03.glb | 210 | 8.53 x 7.58 x 6.96 | pass | retro_boulder_b3 | 6 -> 3 |  |
| Rocks/Rock_01.glb | 48 | 4.63 x 4.95 x 3.88 | pass | retro_rock_01 | 6 -> 3 |  |
| Rocks/Rock_02.glb | 80 | 6.06 x 3.08 x 2.96 | pass | retro_rock_02 | 6 -> 3 |  |
| Rocks/Rock_03.glb | 144 | 6.08 x 5.18 x 4.60 | pass | retro_rock_03 | 6 -> 3 |  |
| Rocks/Rock_04.glb | 128 | 7.80 x 4.95 x 5.40 | pass | retro_rock_04 | 6 -> 3 |  |
| Rocks/Rock_05.glb | 48 | 1.34 x 1.70 x 0.85 | pass | retro_rock_05 | 6 -> 3 |  |
| Rocks/Rock_06.glb | 48 | 0.72 x 0.65 x 0.47 | pass | retro_rock_06 | 6 -> 2 |  |
| Rocks/Rock_07.glb | 80 | 0.76 x 0.89 x 0.65 | pass | retro_rock_07 | 6 -> 3 |  |
| Rocks/Rock_08.glb | 48 | 0.79 x 0.80 x 0.71 | pass | retro_rock_08 | 6 -> 3 |  |

## Trees

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Vegetation/Trees/Birch_A.glb | 2068 | 6.91 x 5.85 x 12.91 | pass | retro_birch_a | 12 -> 5 | 111 faces wound against their own normals (5.4%): wound back; 2202 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Birch_B.glb | 2105 | 7.12 x 6.65 x 11.08 | pass | retro_birch_b | 12 -> 5 | 126 faces wound against their own normals (6.0%): wound back; 2540 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Birch_C.glb | 2040 | 5.85 x 5.82 x 12.32 | pass | retro_birch_c | 12 -> 5 | 218 faces wound against their own normals (10.7%): wound back; 2589 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_A.glb | 3231 | 7.10 x 6.84 x 22.28 | pass | retro_douglas_fir_a | 13 -> 5 | 4381 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_B.glb | 3015 | 6.66 x 6.16 x 21.07 | pass | retro_douglas_fir_b | 13 -> 5 | 1 faces wound against their own normals (0.0%): wound back; 4019 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_C.glb | 3057 | 9.27 x 7.66 x 31.88 | pass | retro_douglas_fir_c | 13 -> 5 | 10 faces wound against their own normals (0.3%): wound back; 3895 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_D.glb | 3111 | 5.07 x 4.43 x 13.42 | pass | retro_douglas_fir_d | 13 -> 5 | 3 faces wound against their own normals (0.1%): wound back; 4055 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_E.glb | 3021 | 2.34 x 2.09 x 6.65 | pass | retro_douglas_fir_e | 12 -> 5 | 2 faces wound against their own normals (0.1%): wound back; 3932 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_F.glb | 1053 | 1.49 x 1.51 x 3.17 | pass | retro_douglas_fir_f | 13 -> 5 | 2 faces wound against their own normals (0.2%): wound back; 1059 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_G.glb | 1158 | 7.24 x 6.97 x 21.03 | pass | retro_douglas_fir_g | 14 -> 5 | 1032 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Douglas Fir/Douglas_Fir_Props.glb | 1318 | 24.05 x 6.97 x 17.30 | pass | retro_douglas_fir_dead, retro_douglas_fir_snag, retro_douglas_fir_stump | 20 -> 5, 5, 4 | 5 faces wound against their own normals (0.4%): wound back; 1014 open edges (cards or a shell): drawn from both sides; its cut log end (material Cap) is Textures.com's TCom_WoodEnds0090: their licence, not CC0; fine in your own game, not to share as a texture |
| Vegetation/Trees/Eucalyptus_A.glb | 2197 | 8.55 x 8.98 x 24.36 | pass | retro_eucalyptus_a | 11 -> 5 | 233 faces wound against their own normals (10.6%): wound back; 2663 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Eucalyptus_B.glb | 1912 | 5.84 x 5.54 x 20.09 | pass | retro_eucalyptus_b | 10 -> 5 | 183 faces wound against their own normals (9.6%): wound back; 2286 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Eucalyptus_C.glb | 2078 | 9.48 x 9.74 x 25.91 | pass | retro_eucalyptus_c | 11 -> 5 | 220 faces wound against their own normals (10.6%): wound back; 2475 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Mate_A.glb | 2111 | 4.53 x 4.51 x 4.52 | pass | retro_mate_a | 11 -> 4 | 38 faces wound against their own normals (1.8%): wound back; 2231 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Mate_B.glb | 2283 | 4.86 x 5.81 x 5.36 | pass | retro_mate_b | 11 -> 4 | 46 faces wound against their own normals (2.0%): wound back; 2447 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Mate_C.glb | 2018 | 3.94 x 4.63 x 4.39 | pass | retro_mate_c | 11 -> 4 | 35 faces wound against their own normals (1.7%): wound back; 2086 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/OakBreakA.glb | 307 | 16.71 x 10.97 x 7.34 | pass | retro_oak_fallen | 8 -> 4 | 1 faces wound against their own normals (0.3%): wound back; 15 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/OakBreakB.glb | 156 | 7.87 x 2.97 x 3.07 | pass | retro_oak_broken_trunk | 8 -> 5 | 1 faces wound against their own normals (0.6%): wound back |
| Vegetation/Trees/Oak_A.glb | 1947 | 18.15 x 18.47 x 20.90 | pass | retro_oak_a | 18 -> 10 | 32 faces wound against their own normals (1.6%): wound back; 2169 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Oak_B.glb | 2073 | 20.15 x 19.35 x 23.35 | pass | retro_oak_b | 18 -> 10 | 40 faces wound against their own normals (1.9%): wound back; 2295 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Oak_C.glb | 1900 | 19.06 x 16.74 x 19.77 | pass | retro_oak_c | 18 -> 10 | 31 faces wound against their own normals (1.6%): wound back; 1965 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_A.glb | 2952 | 8.39 x 8.17 x 16.27 | pass | retro_spruce_a | 14 -> 5 | 4156 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_B.glb | 2952 | 6.72 x 6.64 x 11.99 | pass | retro_spruce_b | 14 -> 5 | 4156 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_C.glb | 3144 | 12.06 x 11.27 x 15.01 | pass | retro_spruce_c | 14 -> 5 | 4252 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_D.glb | 642 | 9.68 x 9.18 x 16.70 | pass | retro_spruce_d | 15 -> 5 | 14 faces wound against their own normals (2.2%): wound back; 586 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_E.glb | 2766 | 5.74 x 5.69 x 9.14 | pass | retro_spruce_e | 13 -> 5 | 3930 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_F.glb | 2424 | 2.59 x 3.09 x 3.90 | pass | retro_spruce_f | 13 -> 5 | 3276 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_G.glb | 234 | 1.19 x 1.06 x 1.75 | pass | retro_spruce_g | 13 -> 4 | 34 faces wound against their own normals (14.5%): wound back; 366 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Picea Abies/Picea_Abies_Props.glb | 667 | 27.04 x 8.15 x 14.03 | pass | retro_spruce_dead, retro_spruce_snag, retro_spruce_stump | 21 -> 5, 5, 4 | 8 faces wound against their own normals (1.2%): wound back; 451 open edges (cards or a shell): drawn from both sides; its cut log end (material Cap) is Textures.com's TCom_WoodEnds0090: their licence, not CC0; fine in your own game, not to share as a texture |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_A.glb | 3170 | 15.96 x 15.14 x 30.52 | pass | retro_scots_pine_a | 22 -> 9 | 4614 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_B.glb | 3143 | 17.48 x 16.90 x 32.21 | pass | retro_scots_pine_b | 22 -> 11 | 6 faces wound against their own normals (0.2%): wound back; 4591 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_C.glb | 3128 | 13.83 x 13.65 x 34.59 | pass | retro_scots_pine_c | 22 -> 11 | 4626 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_D.glb | 2847 | 6.38 x 6.50 x 11.30 | pass | retro_scots_pine_d | 14 -> 5 | 11 faces wound against their own normals (0.4%): wound back; 4257 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_E.glb | 1115 | 2.83 x 2.46 x 4.95 | pass | retro_scots_pine_e | 14 -> 5 | 6 faces wound against their own normals (0.5%): wound back; 1397 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_F.glb | 84 | 0.87 x 0.92 x 1.77 | pass | retro_scots_pine_f | 13 -> 6 | 136 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_G.glb | 1117 | 13.00 x 10.85 x 31.51 | pass | retro_scots_pine_g | 23 -> 10 | 6 faces wound against their own normals (0.5%): wound back; 1405 open edges (cards or a shell): drawn from both sides |
| Vegetation/Trees/Scoth Pine/Scoth_Pine_Props.glb | 1276 | 27.26 x 10.85 x 23.39 | pass | retro_scots_pine_dead, retro_scots_pine_snag, retro_scots_pine_stump | 23 -> 9, 4, 5 | 23 faces wound against their own normals (1.8%): wound back; 1370 open edges (cards or a shell): drawn from both sides |

## Utility

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| pole_concrete_a_lod_0.glb | 188 | 0.28 x 0.28 x 10.20 | pass | retro_pole_concrete_a | 6 -> 2 |  |
| pole_concrete_b_lod_0.glb | 4116 | 1.24 x 1.56 x 10.20 | pass | retro_pole_concrete_b | 12 -> 3 | 42 open edges (cards or a shell): drawn from both sides |
| pole_concrete_c_lod_0.glb | 3056 | 1.24 x 0.28 x 10.20 | pass | retro_pole_concrete_c | 12 -> 3 | 18 open edges (cards or a shell): drawn from both sides |
| pole_concrete_d_lod_0.glb | 2824 | 2.24 x 0.50 x 10.20 | pass | retro_pole_concrete_d | 12 -> 3 |  |
| pole_concrete_e_lod_0.glb (uses pole_concrete_e_lod_1.glb) | 13500 | 4.20 x 1.56 x 10.20 | pass | retro_pole_concrete_e | 13 -> 5 | 13500 triangles, over a low-poly budget of 8000 for its size; 120 open edges (cards or a shell): drawn from both sides; its LOD1 taken instead: 6738 triangles |
| pole_concrete_f_lod_0.glb | 7320 | 2.42 x 2.35 x 10.20 | pass | retro_pole_concrete_f | 13 -> 5 | 40 open edges (cards or a shell): drawn from both sides |
| pole_wood_a_lod_0.glb | 188 | 0.30 x 0.30 x 10.20 | pass | retro_pole_wood_a | 6 -> 2 |  |
| pole_wood_b_lod_0.glb | 2530 | 2.20 x 1.56 x 10.42 | pass | retro_pole_wood_b | 12 -> 2 | 24 open edges (cards or a shell): drawn from both sides |
| pole_wood_c_lod_0.glb | 1470 | 2.20 x 0.40 x 10.42 | pass | retro_pole_wood_c | 12 -> 3 |  |
| pole_wood_d_lod_0.glb | 2664 | 2.20 x 0.49 x 10.20 | pass | retro_pole_wood_d | 12 -> 2 |  |
| pole_wood_e_lod_0.glb (uses pole_wood_e_lod_1.glb) | 10144 | 2.20 x 1.47 x 10.20 | pass | retro_pole_wood_e | 13 -> 4 | 10144 triangles, over a low-poly budget of 8000 for its size; 102 open edges (cards or a shell): drawn from both sides; its LOD1 taken instead: 4026 triangles |
| pole_wood_f_lod_0.glb | 6912 | 2.20 x 2.31 x 10.20 | pass | retro_pole_wood_f | 13 -> 5 | 40 open edges (cards or a shell): drawn from both sides |
| prop_lamp.glb | 404 | 0.52 x 1.28 x 0.99 | pass | retro_street_lamp | 6 -> 1 |  |
| prop_non_conducting_a.glb | 316 | 0.14 x 0.14 x 0.40 | pass | retro_insulator_a | 6 -> 3 |  |
| prop_non_conducting_b.glb | 380 | 0.20 x 0.20 x 0.42 | pass | retro_insulator_b | 6 -> 2 |  |
| prop_non_conducting_c.glb | 302 | 0.19 x 0.19 x 0.42 | pass | retro_insulator_c | 6 -> 3 |  |
| prop_stell_ring.glb | 80 | 0.34 x 0.36 x 0.10 | pass | retro_steel_ring | 6 -> 2 |  |
| prop_transformer.glb | 1412 | 0.64 x 0.82 x 1.20 | pass | retro_transformer | 7 -> 2 | 16 open edges (cards or a shell): drawn from both sides |

## Not added

| file | triangles | size (m) | verdict | recipes | gaps as it came -> as made | notes |
| --- | ---: | --- | --- | --- | --- | --- |
| Props/Gas_Station/Trash.glb | 8 | 0.48 x 0.48 x 0.10 | fail | - | 8 -> not made | a photo of litter on a black square folded into an 8-triangle pyramid 10 cm high: a decal, not a model; its black surround reads as a hole in the ground. The other trash (Trash_Bag, Trash_Box, Trash_Can) and the PBR-made trash_bag stand in for it; 8 open edges (cards or a shell): drawn from both sides |
