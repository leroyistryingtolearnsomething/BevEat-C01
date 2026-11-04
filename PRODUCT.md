# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React front end, Node/Express back end, Microsoft SQL Server database. The app is a mobile-friendly web app; design files are mocked at iPhone 16 Pro size (402×874).

## Users

- **Parents** (primary for this app): busy parents of primary-school children in Singapore. They check in quickly on a phone to see what their child can spend and eat today, set limits and allergies, and top up the child's wallet.
- **Kids** use a separate kids' app (KiddyEats kids view) to order food at hawker centres within the rules the parent sets.

## Product Purpose

KiddyEats lets parents manage how their kids spend on food at hawker centres: a daily spending limit, blocked unhealthy items, and blocked allergens. Parents top up the kid's e-wallet with NETS QR. Success means the parent trusts that their child can only buy food that is safe and within budget, without having to be there.

## Positioning

A closed-loop kids' food wallet for hawker centres where the parent's rules (daily limit, allergies, blocked foods) are enforced before payment, combined with a community photo eMenu where kids' upvoted photos become the menu picture.

## Operating Context

- Parent app screens: Home (today's money left, quick links), Allergy profile, Daily spending limit, What Ethan sees (menu preview with rules applied), Over-limit message preview, History, History detail with nutrition.
- A parent may have more than one child (switcher: Ethan, Chloe).
- Kids pay in the kids' app; parents top up via NETS QR.

## Capabilities and Constraints

- This half of the project covers: kid login, wallet and daily limit, Mum's rules (allergies, blocked items), menu with rules applied, ordering with a pickup code, parent top-up, food photo upload with AI check, and pic battles.
- Not in this half: Ask Bao (AI assistant), stars/rewards/weekly leaderboard, hawker map.
- Allergy-blocked dishes never appear to the child (stated in the parent app's own copy).

## Evidence on Hand

- Parent app design: Figma file `fdsp` (key `2v3cHqT93FRLejnh8b0ekB`).
- Kids app design: Figma file `BiteBuddy – Kids View Prototype` (file name not yet renamed; the app is now KiddyEats) (key `4pBl4YkSuuVZYSeqNh8ldZ`).
- No real users, testimonials or usage data exist yet; do not fabricate them.

## Product Principles

1. The parent's rules are enforced before money moves, never after.
2. Parents should understand their child's day at a glance; detail is one tap away.
3. What the parent previews must be exactly what the child sees.
4. Children's data stays minimal: no location history, nicknames in public places.

## Accessibility & Inclusion

Text and controls must meet WCAG contrast (4.5:1 for normal text) and 44pt minimum touch targets on iPhone.
