# Malayalam translation worksheet

Edit [ml.json](../src/content/locales/ml.json). The matching [en.json](../src/content/locales/en.json) contains English reference text in the same key order.

Example:

```json
{
  "region.kodassery": ""
}
```

Replace the empty string with your preferred Malayalam spelling. Keep the key unchanged, retain JSON commas/quotes, and save as UTF-8. Leave any uncertain value empty. Do not rename IDs or translate the keys. Add no JSON comments.

The file covers four region names, current places, the spice garden, short map names, geography, shop signs, profile/settings copy, bicycle prompts, and control labels. Existing hardcoded Malayalam shop signs have not been assumed correct or copied as approved translations.

**Current status:** the runtime consumes these files through `LocaleProvider`,
the entry/settings language selectors, and localized map/profile/HUD surfaces.
The worksheet remains editable: values not yet reviewed can stay blank.

Selecting Malayalam uses nonempty Malayalam values; missing or whitespace-only
values display English. Selecting English always displays English reference
values. Your explorer's own name remains unchanged. No automatic translation
service is used. The four regions and 12 landmark names are procedural
prototype content; translation wiring does not imply final art, audio, or
device support certification.

Validate edits with:

```sh
python3 -m json.tool src/content/locales/ml.json > /dev/null
```

Run `npm test -- tests/i18n.test.ts` after editing the sheets.

## L01/L02 implementation API

`src/features/i18n/translate.ts` exports the canonical `TranslationKey` type,
`translate(key, locale)`, and `localizedPlace(id, locale)` /
`localizedRegion(id, locale)` helpers. `LocaleProvider` supplies `{ locale, t }`
through React context; `useLocale()` and `useT()` are safe to call without a
provider and default to English. Resolvers trim Malayalam values before using
them, so a blank or whitespace worksheet cell always falls back to English.

`LanguageToggle` accepts exactly `{ value, onChange }`, renders an accessible
English / മലയാളം selector, and keeps its target at least 44px high. It owns no
persistence or application state; the app integration task supplies those
connections.

The current runtime also exposes the implemented movement controls: desktop
WASD/arrows, Shift run, Space jump, R sprint-lock, F bicycle mount/dismount,
mouse drag look, and touch analog/directional movement with right-side look,
jump, sprint-lock, and bicycle actions. Touch mode is selected through the
Auto/Touch/Desktop Settings choice. Malayalam worksheet cells remain blank by
default so keys are preserved while translations are reviewed.

The English inventory now includes entry, atlas, profile, settings, map,
controls, bicycle, landmark descriptions, and the existing region/place/sign
keys. The Malayalam sheet has matching blank cells so translators can review
each string without machine-generated guesses.
