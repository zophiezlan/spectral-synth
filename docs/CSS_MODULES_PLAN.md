# CSS Modularization Plan

This document outlines the plan for splitting the monolithic `style.css` (2,652 lines) into maintainable modules.

## Current State

- **File**: `public/styles/style.css`
- **Size**: 2,652 lines
- **Issues**:
  - Difficult to navigate and maintain
  - No clear separation of concerns
  - Hard to find specific styles
  - Large file size impacts development experience

## Proposed Modular Structure

### Module Organization

```
public/styles/
├── main.css              # Main entry point (imports all modules)
├── style.css             # Legacy file (keep for compatibility)
└── modules/
    ├── variables.css     # CSS custom properties and theme definitions
    ├── base.css          # Base elements (html, body, typography)
    ├── layout.css        # Page structure (header, main, footer)
    ├── components.css    # Reusable components (buttons, inputs, sliders)
    ├── sidebar.css       # Sidebar navigation styles
    ├── modals.css        # Modal dialogs and overlays
    ├── visualizations.css # Canvas, spectrum, peak tooltips
    ├── utilities.css     # Utility classes, loading, toasts
    ├── animations.css    # Keyframes and transitions
    ├── accessibility.css # Focus indicators, reduced motion, ARIA
    └── mobile.css        # Responsive design and mobile optimizations
```

## Module Breakdown

### 1. variables.css (~87 lines)
**Purpose**: Centralized theme definitions

**Contents**:
- CSS custom properties for colors
- Light/dark theme variables
- Spacing, sizing, timing constants
- Z-index layers

**Benefits**:
- Easy theme customization
- Consistent values across app
- Single source of truth

**Lines**: 7-94 from current style.css

---

### 2. base.css (~200 lines)
**Purpose**: Base element styles

**Contents**:
- HTML, body styles
- Typography (h1, h2, h3, p)
- Links
- Basic form elements
- Header structure

**Lines**: 95-294

---

### 3. components.css (~450 lines)
**Purpose**: Reusable UI components

**Contents**:
- Buttons (primary, secondary, icon buttons)
- Input fields (text, range, select)
- Sliders and controls
- Filters and search
- Substance selector
- Playback controls
- ADSR controls
- Collapsible sections
- Favorites button

**Lines**: 295-744

---

### 4. sidebar.css (~150 lines)
**Purpose**: Sidebar navigation

**Contents**:
- Sidebar container
- Sidebar overlay
- Sidebar menu items
- Sidebar animations
- Burger menu

**Lines**: (scattered, ~150 lines total)

---

### 5. modals.css (~500 lines)
**Purpose**: All modal dialogs

**Contents**:
- Modal overlay base styles
- Settings modal
- Import/Export modal
- MIDI modal
- Help modal
- Onboarding modal
- Tutorial path modal

**Lines**: 1251-1750 (approx)

---

### 6. visualizations.css (~250 lines)
**Purpose**: Spectrum visualizations

**Contents**:
- Canvas containers
- FTIR/Audio FFT panels
- Peak tooltips
- Axis labels
- Peak selection UI
- Smart suggestions

**Lines**: 594-844

---

### 7. utilities.css (~200 lines)
**Purpose**: Utility classes and helpers

**Contents**:
- Loading overlay
- Toast notifications
- Screen reader only class
- Hidden class
- Disabled states
- Results count

**Lines**: 960-1160

---

### 8. animations.css (~150 lines)
**Purpose**: Animations and transitions

**Contents**:
- Keyframe animations
- Pulsing effects
- Ripple effects
- Fade in/out
- Slide animations

**Lines**: 1516-1666

---

### 9. accessibility.css (~100 lines)
**Purpose**: Accessibility features

**Contents**:
- Focus indicators
- High contrast mode
- Reduced motion support
- WCAG color contrast fixes
- Keyboard navigation styles

**Lines**: 1117-1217

---

### 10. mobile.css (~565 lines)
**Purpose**: Responsive design

**Contents**:
- Mobile viewport styles
- Touch improvements
- Landscape optimizations
- Extra small device styles
- Tablet styles

**Lines**: 1547-2112

---

## Implementation Strategy

### Phase 1: Preparation (Completed ✅)
- [x] Create main.css entry point
- [x] Create modules directory
- [x] Document module plan (this file)

### Phase 2: Extract Core Modules (Priority)
- [ ] Extract variables.css (highest impact)
- [ ] Extract base.css
- [ ] Extract utilities.css
- [ ] Test that styles still work

### Phase 3: Extract Component Modules
- [ ] Extract components.css
- [ ] Extract sidebar.css
- [ ] Extract modals.css
- [ ] Extract visualizations.css

### Phase 4: Extract Special Modules
- [ ] Extract animations.css
- [ ] Extract accessibility.css
- [ ] Extract mobile.css

### Phase 5: Finalize
- [ ] Update HTML to use main.css
- [ ] Keep style.css as legacy fallback
- [ ] Add source maps for debugging
- [ ] Document new structure in STRUCTURE.md
- [ ] Update service worker cache list

## Migration Path

### Option A: Gradual Migration (Recommended)
1. Create all module files
2. Keep original style.css
3. Add main.css as alternative
4. Update HTML to use main.css
5. Test thoroughly
6. After stable, remove style.css

### Option B: Big Bang Migration
1. Split style.css into modules
2. Replace style.css reference with main.css
3. Remove old style.css

**Recommendation**: Use Option A for safety

## Benefits

### For Development
- **Easier to navigate**: Find styles by category
- **Better organization**: Logical separation
- **Reduced conflicts**: Less merge conflicts in git
- **Faster edits**: Edit only relevant module

### For Maintenance
- **Clear ownership**: Each module has clear purpose
- **Easier refactoring**: Update one module at a time
- **Better testing**: Test modules independently
- **Simpler reviews**: Smaller diffs in PRs

### For Performance
- **Potential lazy loading**: Load only needed styles
- **Better caching**: Modules cache independently
- **Easier minification**: Optimize per module
- **Tree shaking**: Remove unused styles (future)

## Potential Issues & Solutions

### Issue 1: CSS Specificity
**Problem**: Module order might affect specificity

**Solution**:
- Document required load order
- Use BEM methodology for naming
- Avoid !important unless necessary

### Issue 2: Duplicate Styles
**Problem**: Some styles might belong to multiple modules

**Solution**:
- Create shared mixins
- Use CSS variables for common values
- Accept small duplication when needed

### Issue 3: Testing Overhead
**Problem**: Need to test all modules work together

**Solution**:
- Create visual regression tests
- Manual testing checklist
- Keep original style.css as reference

### Issue 4: Build Complexity
**Problem**: Managing multiple CSS files

**Solution**:
- Use @import for simplicity (current approach)
- Future: Add CSS bundler if needed
- Keep build-free approach where possible

## Tools & Automation

### Potential Tools (Future)
- **PostCSS**: For @import resolution
- **PurgeCSS**: Remove unused styles
- **CSSNano**: Minification
- **Stylelint**: CSS linting

### Current Approach
- **No build step**: Keep zero-dependency philosophy
- **Manual splitting**: Careful extraction
- **Browser @import**: Native CSS imports
- **Git history**: Preserve file history where possible

## Timeline Estimate

- Phase 1 (Prep): ✅ Completed
- Phase 2 (Core modules): ~4 hours
- Phase 3 (Components): ~6 hours
- Phase 4 (Special modules): ~3 hours
- Phase 5 (Finalize): ~2 hours

**Total**: ~15 hours of focused work

## Success Criteria

- [ ] All existing functionality works
- [ ] No visual regressions
- [ ] Styles load correctly in all browsers
- [ ] Service worker caches all modules
- [ ] Developer experience improved
- [ ] Documentation updated
- [ ] Tests pass

## Notes

- Keep this document updated as work progresses
- Add examples and code snippets as modules are created
- Document any gotchas or lessons learned

---

**Status**: Planning Complete, Ready for Implementation
**Created**: 2025-12-03
**Updated**: 2025-12-03
