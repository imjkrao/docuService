# Product notes

Working notes on what this is, who buys it, and what has to be true for it to be
worth selling. Opinionated on purpose — argue with it.

## The observation

Engineering teams already write Markdown and commit it to Azure Repos. The files
are good. They are also effectively unreadable: people browse them through the
Azure DevOps file viewer, one file at a time, with no search across the set, no
navigation, and no way to send a link to someone outside the team.

The gap is not "we need a documentation tool." It is the last hundred metres
between *files that exist* and *a site people can read*.

## Why the existing answer does not close it

MkDocs, Docusaurus, Hugo and VitePress all render Markdown into a site, and
Azure Static Web Apps will host any of them. Free, mature, well documented. So
the honest question is why anyone would pay.

They all assume you are **starting a documentation project**. Each one wants a
config file, a specific source layout, and a hand-maintained navigation
structure. Docusaurus wants a Node project and its own front matter. MkDocs
wants `mkdocs.yml` with an explicit `nav:` list. Hugo wants a theme and content
directories. Pointing any of them at a repository whose Markdown grew
organically means restructuring the repository first — and that is the work
nobody schedules.

docuservice inverts the requirement: **the repo as it stands is valid input.**
That is the wedge. It is a narrow one, and it is not by itself a business.

## Where the actual business is

Zero-config rendering gets adoption. It does not get budget. The things that get
budget are the ones a free generator structurally does not do:

1. **Private docs.** Internal documentation cannot be a public website. Static
   Web Apps supports Entra ID authentication and role assignment; wiring
   group-based access to a docs portal, per-section, is real work customers will
   pay to not do. This is the single strongest paid feature.
2. **Multi-repo aggregation.** Large orgs have documentation scattered across
   dozens of repositories. One portal that pulls Markdown from many Azure Repos,
   merges the navigation and searches across all of it is something no
   single-repo generator does. This is the feature that turns a tool into a
   platform purchase.
3. **Documentation health.** Which pages have not been touched in a year. Which
   links are broken, including cross-repo. Which code has no docs. Reported per
   team, with a trend line. Engineering managers buy reports; developers do not
   buy generators.
4. **Publishing governance.** Approval before production, staging URLs on every
   pull request, audit of who published what.

Ranked by build cost against willingness to pay: **(1) then (3) then (2)**. Item
2 is the biggest engineering lift and should follow evidence of demand.

## Shape of the offering

| Tier | Contents | Rationale |
| --- | --- | --- |
| Open source CLI | Everything in this repository | Adoption engine. Must be genuinely good and genuinely free — a crippled OSS tier kills the funnel. |
| Team | Entra ID-gated sites, PR previews, hosted build, themes | The first thing worth paying for. Priced per site. |
| Enterprise | Multi-repo portals, health reporting, approvals, SSO admin, support | Priced per organisation. |

Distribution: publish the CLI to npm, an Azure DevOps extension in the
Marketplace (a build task wrapping `docuservice build` beats asking people to
paste YAML), and the paid tiers as an Azure Marketplace SaaS offer so spend
lands on the customer's existing Azure commitment. That last point matters more
than it sounds — committed-spend drawdown removes procurement from the sale.

## What has to be proven before building the paid tiers

- Does a team point this at a real, messy repository and get a usable site on
  the first try? If the answer needs a support conversation, the wedge is gone.
- Is "we can't make it private" the first objection? If it is, item 1 above is
  the right next build.
- Does anyone maintain the site after the first month? If pages go stale and
  nobody notices, item 3 is the product and rendering is the feature.

## Deliberate non-goals

- **Not a WYSIWYG editor.** Authoring happens in the repo. The moment editing
  moves into a web app, the product competes with Confluence and SharePoint on
  their terms, and loses.
- **Not a wiki.** No comments, no page-level permissions beyond what Entra ID
  groups express, no in-app workflow.
- **Not a framework.** No plugin API in v1. Plugin APIs are permanent
  commitments made before you know what customers extend.
- **Not multi-cloud in v1.** "Azure Repos → Azure Static Web Apps" is a sharper
  story than "works everywhere," and the Marketplace listing is the channel.

## Current state

The CLI in this repository is a working MVP: it discovers, renders, links,
searches, themes, and emits an Azure-ready site plus the pipeline to deploy it.
It has tests. It does not yet have authentication, multi-repo support, or
hosting — all of which are the paid surface, and all of which should wait for
the first real customer repository to argue with.
