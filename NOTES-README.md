# notes.teachershokh.blog

Quartz 5 site built from the "ELT Second Brain" folder of the Obsidian vault.

## Publish new or edited notes

    npm run publish-notes

That copies the publishable notes from the vault into `content/`, commits and pushes. GitHub Actions rebuilds the site in about two minutes.

## What gets published (publish.config.json)

- Everything in `include` (the ELT Second Brain folder), except `exclude` (04 Index).
- Any other note in the vault with `publish: true` in its frontmatter.
- Never: a note with `publish: false` or `draft: true`.
- Removed on the way out (the vault is never changed): "Apply in my context" sections, "Why it matters for me" / "Value for me" lines, and any sentence, list item or section naming a term in `privateTerms`.
- Links to notes that aren't published turn into plain text.

## Preview locally

    npm run sync && npm run preview      # http://localhost:8080 (wordmark shows as plain text in preview)
