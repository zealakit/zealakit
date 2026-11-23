# Checklist

## Before you start

- [ ] `profile.json` exists and matches the repository (name, units, layout).
- [ ] The layout file for every unit is open; no other layout is.
- [ ] The fact sources for this change are known (manifest, `.env.example`,
      router, `--help`).

## Before you finish

- [ ] One H1 per README, equal to the unit name in the profile.
- [ ] Required sections present and in the layout's order.
- [ ] `profile.sections` sections exist and come from recipe facts.
- [ ] Scripts table rows all exist in the manifest; no manifest script is
      missing from the table.
- [ ] Environment table and `.env.example` contain the same keys.
- [ ] Every command is complete and copy-pasteable.
- [ ] Links match `linkStyle`; images end in `?raw=true` when absolute.
- [ ] No link into `.agents/` from user-facing docs.
- [ ] No `TODO`, no placeholder values, no invented ports or keys.
- [ ] Translations have identical heading levels, code blocks and table shapes.
- [ ] The checker passes (`profile.check`).
- [ ] `CHANGELOG.md` updated when user-visible behavior changed.

## Porting this skill to another repository

- [ ] Copy this folder to `<repo>/.agents/skills/repo-docs/`.
- [ ] Replace `profile.json`; keep the schema.
- [ ] Pick a layout per unit; a single-package repo usually uses `library`,
      `app`, `service`, `worker` or `cli`.
- [ ] Set `linkStyle`:
  - `absolute` for published packages (npm registry renders the README away
    from GitHub). Set `absoluteBase` to `https://github.com/<owner>/<repo>/blob/<branch>`.
  - `relative` for private applications.
- [ ] Add `profile.check` and expose it as a package script.
- [ ] Run the checker on the existing READMEs. Any failure is either a doc bug
      or a profile typo — fix the doc, not the rule.
