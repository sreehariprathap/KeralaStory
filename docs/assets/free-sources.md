# Free asset sources for the final art pass

User will supply final assets later. These are researched source options, not downloaded assets or approval of any particular model.

| Source | Best use here | Format/license notes |
|---|---|---|
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Rigged stylized travelers and compatible starting rigs | Pack offers glTF/FBX/Blend/OBJ; CC0. Adapt clothing/proportions to the anime Kerala brief. |
| [VRoid Studio](https://vroid.com/en/studio) | Custom anime traveler appearances | Free creation tool; exports VRM, requiring conversion/preparation for our GLB pipeline. Follow [VRoid guidelines](https://vroid.com/en/studio/guidelines); third-party clothing/hair items may have their own terms. |
| [Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Humanoid rigging, walk/run/jump and other animation clips | Free use with Adobe ID; humanoid limitations. [Workflow](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html) uses FBX/OBJ/ZIP inputs; convert/retarget before GLB delivery. |
| [Kenney assets](https://kenney.nl/assets) | Supporting props, generic stylized objects | Asset-page game assets are CC0 per [support](https://kenney.nl/support). Not a complete Kerala architecture kit. |
| [Poly Haven](https://polyhaven.com/) | Natural/environment props and material bases | CC0 under its [license](https://polyhaven.com/license); styles may need simplification to match the game. |
| [Sketchfab downloadable models](https://sketchfab.com/features/free-3d-models) | Specific regional props that generic kits lack | Review each model's license; free download is not a uniform license. Follow [download guidelines](https://sketchfab.com/developers/download-api/guidelines), including attribution where required. |

Recommended starting combination: VRoid or Quaternius traveler + compatible Quaternius/Mixamo clips + Kenney/Quaternius supporting props. Kerala roofs, shops, temple courtyard and local vegetation will still need art adaptation.

Keep source URL, original filename, author, license text and required attribution beside every asset. Normalize exports to meters, Y-up, feet/base pivots and +Z character forward. Deliver a shared skeleton and the named clips from the design bible; inspect materials, feet alignment, scale, collision proxies and triangle/texture budgets before replacing prototypes. A `.vrm`, `.fbx` or `.blend` filename renamed to `.glb` is not a conversion.
