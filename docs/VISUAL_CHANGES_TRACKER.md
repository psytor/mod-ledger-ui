# Visual Changes Review - Mod Ledger UI

This document lists all the visual elements from `tmp/astrogators-table/frontend` that differ from the current `mod-ledger-ui` implementation. Review each section and mark items with ✅ (keep/implement) or ❌ (skip/remove).

---

## 1. Chamfered Corner System ⭐

**Status:** ✅ Keep - COMPLETED

**Description:** The original asymmetric chamfered corner design you worked hard on.

**Changes:**
- [x] Restore asymmetric chamfered corners (top: 12px, bottom-left: 12px, **bottom-right: 24px**)
- [x] Add diagonal corner borders with proper transforms
- [x] Size variations: `chamfered-sm`, `chamfered-md`, `chamfered-lg`
- [x] Hover effects for border color transitions
- [x] Reusable CSS classes: `.chamfered-box`, `.chamfered-borders`, `.chamfered-card`

**Files:**
- Source: `tmp/astrogators-table/frontend/src/styles/chamfered.css`
- Target: `astrogators-shared-ui/src/styles/effects.css` (implemented in v0.4.2)
- Applied to: `mod-ledger-ui` and `astrogators-hub`

**Notes:** Implemented in shared-ui v0.4.2 with Card component support. Both mod-ledger-ui and astrogators-hub now use chamfered corners.

---

## 2. Mod Card Tier-Based Styling

**Status:** ✅ Keep - COMPLETED

**Description:** Use tier color (Grey/Green/Blue/Purple/Gold) for borders and glows instead of evaluation colors.

**Changes:**
- [x] Tier-colored borders matching sprite tints exactly:
  - Grey: `#b4bac7`
  - Green: `#84cc16` (lime green)
  - Blue: `#3b82f6`
  - Purple: `#8b5cf6`
  - Gold: `#fbbf24`
- [x] External glow effect based on tier color (not evaluation)
- [x] Gradient glow backgrounds that blur on hover
- [x] Keep evaluation badges but use tier colors for card borders

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/ModCard.tsx` (lines 22-29, 82-98)
- Target: `mod-ledger-ui/src/components/ModCard/ModCard.tsx`

**Notes:** Already implemented in mod-ledger-ui. Card borders and glows use tier colors, evaluation badges remain separate.

---

## 3. Efficiency Bars Component

**Status:** ✅ Keep - COMPLETED

**Description:** Horizontal efficiency bars with inline percentage text.

**Changes:**
- [x] Create `EfficiencyBars` component
- [x] Blue gradient scale (dark to bright: `bg-blue-900` → `bg-blue-500`)
- [x] Inline percentage overlays on bars
- [x] Inactive bar states (30% opacity)
- [x] Compact/normal size variants
- [x] Show up to 5 rolls maximum

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/EfficiencyBars.tsx`
- Target: `mod-ledger-ui/src/components/mod/SecondaryStatColumn.tsx` (implemented)

**Usage:**
- In ModDetailModal (full-size version with dynamic color coding)

**Notes:** Implemented in SecondaryStatColumn with dynamic color coding based on efficiency percentage.

---

## 4. Card Component System

**Status:** [ ] Keep / [ ] Skip

**Description:** Reusable Card components with chamfered styling.

**Changes:**
- [ ] Create base `Card` component with chamfered borders
- [ ] Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- [ ] Backdrop blur effect (`backdrop-blur-sm`)
- [ ] Consistent spacing and typography

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/shared/Card.tsx`
- Target: `mod-ledger-ui/src/components/shared/Card/` (create)

**Notes:** Used extensively in FilterSidebar and throughout the app.

---

## 5. Button System with CVA

**Status:** [ ] Keep / [ ] Skip

**Description:** Button component using `class-variance-authority` for variants.

**Changes:**
- [ ] Install `class-variance-authority` package
- [ ] 7 variants: default, secondary, outline, ghost, danger, success, warning
- [ ] 5 sizes: sm, default, lg, xl, icon
- [ ] Loading states with spinner (using `lucide-react` Loader2 icon)
- [ ] Proper focus rings with offset
- [ ] `loadingText` prop support

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/shared/Button.tsx`
- Target: `mod-ledger-ui/src/components/shared/Button/Button.tsx` (update)

**Dependencies:**
```bash
npm install class-variance-authority lucide-react
```

---

## 6. Enhanced Modal System

**Status:** [ ] Keep / [ ] Skip

**Description:** Modal with more features than current implementation.

**Changes:**
- [ ] Portal-based rendering with `react-dom/createPortal`
- [ ] Backdrop blur (`backdrop-blur-sm`)
- [ ] 5 size options: sm, md, lg, xl, full
- [ ] Escape key handling (can be disabled)
- [ ] Focus management (restores focus on close)
- [ ] Body scroll locking
- [ ] Smooth animations (opacity + scale + translateY)
- [ ] Responsive max-heights for mobile
- [ ] `titleBarContent` prop for custom title bar elements
- [ ] `closeOnOverlayClick` and `closeOnEscape` props

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/shared/Modal.tsx`
- Target: `mod-ledger-ui/src/components/shared/Modal/Modal.tsx` (update)

---

## 7. Input Component Enhancements

**Status:** [ ] Keep / [ ] Skip

**Description:** Enhanced input with icon support and better states.

**Changes:**
- [ ] Left/right icon support with proper positioning
- [ ] Label with required indicator (`*`)
- [ ] Error and helper text states
- [ ] Focus rings matching button system
- [ ] Dark mode styling (gray-900 background)
- [ ] ForwardRef support for form libraries

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/shared/Input.tsx`
- Target: `mod-ledger-ui/src/components/shared/Input/Input.tsx` (update)

---

## 8. Filter Sidebar Design

**Status:** ✅ Keep - PARTIALLY COMPLETED

**Description:** Sliding sidebar with vertical tab and comprehensive filters.

**Changes:**
- [x] Sliding panel from right with dark overlay
- [x] Vertical "FILTERS" tab that stays visible when closed
- [x] Active filter indicator dot on tab
- [x] Item counts in section headers
- [ ] Multiple filter sections with icons:
  - Set filters (4-column grid with SetIcon) - TODO
  - Slot filters (6-column grid with sprites) - TODO
  - Tier filters (5-column grid with color badges) - TODO
  - Dots filters (3-column grid with visual dots) - TODO
  - Primary/secondary stat filters (2-column grids) - TODO
- [ ] Selected state styling with colored borders and glow - TODO
- [ ] Search bar integration with icon - TODO
- [ ] Evaluation mode dropdown with help button - Already exists
- [ ] Evaluation help modal - TODO
- [ ] Recommendation filter buttons (All/Keep/Sell/Slice/Level/Locked) - Already exists
- [x] "Clear Filters" button (disabled when no active filters) - Already exists

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/FilterSidebar.tsx`
- Target: `mod-ledger-ui/src/components/filter/FilterPanel.tsx` (updated)

**Notes:** Implemented core UX improvements: vertical tab, active indicator, item counts. Grid layouts and visual filter buttons pending.

---

## 9. Mod Shape Visual Tinting

**Status:** [ ] Keep / [ ] Skip

**Description:** CSS filter-based sprite tinting for tier colors.

**Changes:**
- [ ] Tier color tint classes: `.tint-grey`, `.tint-green`, `.tint-blue`, `.tint-purple`, `.tint-gold`
- [ ] Pixelated image rendering for crisp sprites
- [ ] Complex CSS filter values for accurate color matching
- [ ] Multi-layer sprite system (main + inner + set icon)

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/ModShapeVisual.css`
- Target: `mod-ledger-ui/src/components/ModShapeVisual/ModShapeVisual.module.css` (update)

**Filter Values:**
```css
.tint-grey { filter: brightness(0) saturate(100%) invert(85%) sepia(10%) saturate(1300%) hue-rotate(170deg) brightness(110%) contrast(90%); }
.tint-green { filter: brightness(0) saturate(100%) invert(77%) sepia(96%) saturate(642%) hue-rotate(38deg) brightness(105%) contrast(95%); }
.tint-blue { filter: brightness(0) saturate(100%) invert(52%) sepia(73%) saturate(2375%) hue-rotate(188deg) brightness(102%) contrast(101%); }
.tint-purple { filter: brightness(0) saturate(100%) invert(32%) sepia(98%) saturate(1255%) hue-rotate(248deg) brightness(97%) contrast(92%); }
.tint-gold { filter: brightness(0) saturate(100%) invert(85%) sepia(56%) saturate(552%) hue-rotate(353deg) brightness(101%) contrast(104%); }
```

---

## 10. Global Styles & Utilities

**Status:** ✅ Keep - COMPLETED

**Description:** Global CSS utilities and patterns.

**Changes:**
- [x] Custom dark scrollbar styling
- [x] Blue selection color with opacity
- [x] Skeleton loading animation
- [x] `.mod-grid` responsive grid (1→2→3→4→5→6 columns)
- [x] `.mod-grid-compact` responsive grid (2→3→4→6→8 columns)
- [x] `.smooth-transition` utility
- [x] `.glass` glassmorphism effect
- [x] Evaluation result text color utilities

**Files:**
- Source: `tmp/astrogators-table/frontend/src/app/globals.css`
- Target: `mod-ledger-ui/src/index.css` (implemented)

**Notes:** Added all global utilities to mod-ledger-ui index.css. Focus-visible-custom skipped as shared-ui already handles focus states.

---

## 11. Tailwind Configuration

**Status:** [ ] Keep / [ ] Skip

**Description:** Extended Tailwind configuration with custom colors and animations.

**Changes:**
- [ ] Extended primary color scale (50-900 shades of blue)
- [ ] Evaluation color theme:
  - `evaluation.keep`: `#10b981`
  - `evaluation.sell`: `#ef4444`
  - `evaluation.upgrade`: `#f59e0b`
  - `evaluation.slice`: `#8b5cf6`
  - `evaluation.calibrate`: `#06b6d4`
- [ ] Inter font family configuration
- [ ] Custom animations: `fade-in`, `slide-up`
- [ ] Tailwind plugins: `@tailwindcss/forms`, `@tailwindcss/typography`

**Files:**
- Source: `tmp/astrogators-table/frontend/tailwind.config.ts`
- Target: `mod-ledger-ui/tailwind.config.js` (update)

**Dependencies:**
```bash
npm install @tailwindcss/forms @tailwindcss/typography
```

---

## 12. Mod Detail Modal Enhancements

**Status:** [ ] Keep / [ ] Skip

**Description:** Enhanced ModDetailModal with better layout and efficiency bars.

**Changes:**
- [ ] Horizontal info row layout (set, slot, tier, level, character)
- [ ] Tier-colored tier text (not just white)
- [ ] 4-column grid for secondary stats
- [ ] Large efficiency bars for each secondary stat
- [ ] Calibration counter in title bar (using `titleBarContent` prop)
- [ ] Evaluation verdict badge on same line as title
- [ ] Overall efficiency display in separate section

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/ModDetailModal.tsx`
- Target: `mod-ledger-ui/src/components/ModDetailModal/ModDetailModal.tsx` (update)

**Dependencies:**
- Requires EfficiencyBars component
- Requires enhanced Modal component

---

## 13. ModCard Layout Tweaks

**Status:** [ ] Keep / [ ] Skip

**Description:** Minor layout and styling improvements to ModCard.

**Changes:**
- [ ] Lift animation on hover (`translateY(-2px)`)
- [ ] Better lock icon positioning and styling
- [ ] Compact padding variant
- [ ] Efficiency badge with better contrast
- [ ] Evaluation badge in top-left corner
- [ ] 3-section layout (left: shape, right: stats, bottom: character/calibrations)

**Files:**
- Source: `tmp/astrogators-table/frontend/src/components/mod-ledger/ModCard.tsx`
- Target: `mod-ledger-ui/src/components/ModCard/ModCard.tsx` (update)

---

## Additional Dependencies Needed

If implementing all changes, you'll need:

```bash
cd mod-ledger-ui
npm install class-variance-authority lucide-react @tailwindcss/forms @tailwindcss/typography
```

---

## Implementation Priority Suggestions

**High Priority** (Core visual identity):
1. Chamfered Corner System (#1)
2. Mod Card Tier-Based Styling (#2)
3. Global Styles & Utilities (#10)

**Medium Priority** (Enhanced UX):
4. Efficiency Bars Component (#3)
5. Filter Sidebar Design (#8)
6. Enhanced Modal System (#6)

**Low Priority** (Nice to have):
7. Button System with CVA (#5)
8. Card Component System (#4)
9. Input Component Enhancements (#7)
10. Remaining items

---

## Review Instructions

1. Go through each section above
2. Mark checkboxes with `[x]` for items to implement
3. Mark entire sections with ✅ Keep or ❌ Skip
4. Add any notes or modifications you want in the Notes sections
5. Save this file and let me know when ready

Once you've reviewed, I'll implement only the changes you've marked to keep!
