# notes.teachershokh.blog

Quartz 5 site built from the whole Obsidian vault (every section except 99 Review).

## Publish new or edited notes

    npm run publish-notes

That copies the publishable notes from the vault into `content/`, commits and pushes. GitHub Actions rebuilds the site in about two minutes.

## What gets published (publish.config.json)

- Every folder in `include` (01 Teaching to 07 Clippings & Tweets), with `00 Home.md` as the front page. Folder paths are kept as they are in the vault.
- Never: anything in `exclude` (99 Review, 98 Attachments), notes named `Template - …`, and notes with `publish: false` or `draft: true` in their frontmatter.
- Notes go up as written: nothing is stripped (`stripSections`, `stripLinePrefixes` and `privateTerms` are empty; add terms there to hide them again).
- Images are copied only when a published note embeds them. Links to notes that aren't published turn into plain text.

## Preview locally

    npm run sync && npm run preview      # http://localhost:8080 (wordmark shows as plain text in preview)
