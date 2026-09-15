# 3D Assets & Media Directory

This directory contains the 3D models and media assets organized by region and category.

## Technical Specifications
* **Format**: `.glb` (glTF 2.0 binary)
* **Coordinate System**: Meters, **Y-up**, **+Z forward**
* **Pivots**: Character models pivot at feet `(0, 0, 0)`; environment models pivot at ground-level base center.
* **Naming Convention**: `ks_[region]_[category]_[asset_name]_[variant].glb` (e.g. `ks_kadambode_buildings_temple_v01.glb`)
* **Triangles / Materials**:
  * Avatars: $\le 35\text{k}$ triangles, $\le 4$ materials
  * Hero Buildings / Landmarks: $\le 25\text{k}$ triangles
  * Foliage / Props: $\le 2\text{k}$ triangles (with LODs where applicable)

---

## Directory Organization

### 1. `shared/`
Assets used globally across multiple biomes.
* `buildings/`: Common laterite compound walls, wells, generic sheds.
* `plantations/`:
  * `coconut_palm.glb`
  * `patch_of_grass.glb`
  * `jabami_anime_bush_v1.glb`
  * `jabami_anime_tree-grass_v1.glb`
* `vehicles/`:
  * `ksrtc_bus_kerala.glb` (Kerala State RTC bus)
  * `maruti_800_lowpoly_free_download.glb` (Classic 2000s Maruti 800)
* `living-beings/`: Traveler avatar rigs, common fauna (crows, egrets, stray dogs, cattle).
* `props/`: Concrete electricity poles, sagging power lines, stone benches, lanterns, signposts.

### 2. `kodassery/` (Kodassery Peaks)
Misty highland trails, canopy forests, and waterfalls.
* `buildings/`:
  * `dlx_-_tree_housewith_tree.glb` (Canopy treehouse)
* `plantations/`:
  * `big_tree.glb` (High canopy forest tree)
  * `maple_tree.glb` (Highland tree)
  * `jabami_anime_tree_v1.glb`
  * `jabami_anime_tree_v4.glb`
* `vehicles/`: Wooden handcarts, mountain transport sleds.
* `living-beings/`: Malabar hornbills, mountain monkeys, highland birds.
* `props/`:
  * `waterfall.glb` (Silverthread falls landmark)

### 3. `kadambode/` (Kadambode Village & Temple)
Rural village life, paddy terraces, and temple courtyards.
* `buildings/`:
  * `indian_house_old.glb` (Traditional Kerala village house)
  * `old_wooden_house_05_farm_house.glb` (Farmhouse overlooking paddies)
  * `old_hut.glb` (Village hut)
* `plantations/`:
  * `mango_tree.glb` (Kerala village mango tree)
  * `coconut_tree.glb`
  * `coconut_tree (1).glb`
  * `coconut_tree_low_poly.glb`
  * `banana_tree.glb`
  * `banana_tree (1).glb`
  * `banana-x-plant-iv.glb`
  * `banana_tree_-_low_polygon.glb`
  * `jabami_anime_tree_v2.glb`
  * `jabami_anime_tree_v3.glb`
  * `jabami_anime_tree_v6.glb`
* `vehicles/`: Bullock carts, delivery bicycles.
* `living-beings/`:
  * `south_indian_men_._traditional_fit.glb` (Traditional attire village character)
* `props/`: Temple tank (*kulam*) stone steps, brass *nilavilakku* lamps, tea shop benches, steel tumblers.

### 4. `kurumali/` (Kurumali Puzha River Crossing)
Wide river banks, wooden bridges, and fishing outposts.
* `buildings/`: Riverside boat sheds, ferry ghat shelters, bamboo fishing huts.
* `plantations/`:
  * `palm_tree_realistic.glb`
  * `tropical_plants_pack_m02p.glb`
* `vehicles/`:
  * `vallam_wooden_boat.glb` (Traditional wooden river boat)
* `living-beings/`: Kingfishers, pond herons, river fish, fishermen.
* `props/`: Wooden bridge deck & pilings, Chinese fishing nets (*cheena vala*), coir ropes, mooring pegs.

### 5. `kodaly/` (Kodaly Bazaar & Coastal Harbor)
Bustling coastal market town, lighthouse, and working pier.
* `buildings/`:
  * `rusty_old_tropical_shop.glb` (Bazaar street shopfront)
  * `low_poly_mansion__house.glb` (Town estate)
  * `under_construction_indian_house.glb` (Concrete construction town house)
* `plantations/`: Seaside palms, casuarina trees, coastal brush.
* `vehicles/`: Fishing trawlers, cargo boats, harbor loading trucks.
* `living-beings/`: Seagulls, harbor stray cats, merchants.
* `props/`:
  * `traffic_light.glb` (Town junction signal)

