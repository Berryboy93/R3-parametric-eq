# R3 NATIVE — Color System Integration (Professional)

**Status:** Production-Ready  
**Protocol:** WIRE (read-before-write, backups, dry-run defaults)  
**Governance:** CLAUDE.md compliant (no Redux, no console.log, Zustand only)  
**Target Environment:** Stable monorepo (canonical ~/Stable)  
**Execution:** Termux/Android (primary dev environment)

---

## Architecture Overview

```
packages/shared/
├── theme/
│   ├── colors.ts                 # Core color tokens (replaces old system)
│   ├── audio.ts                  # DAW-specific colors
│   ├── gradients.ts              # Gradient utilities
│   ├── types.ts                  # TypeScript type definitions
│   └── index.ts                  # Barrel export (single import point)
│
apps/client/
├── src/
│   ├── styles/
│   │   ├── theme.css             # Global CSS custom properties
│   │   ├── utilities.css         # Button, card, badge utilities
│   │   ├── reset.css            # Normalize + R3 defaults
│   │   └── index.css            # Main entry point (imports all)
│   ├── components/
│   │   ├── ui/                   # R3 design system components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── index.ts
│   │   ├── audio/                # DAW-specific components
│   │   │   ├── Waveform.tsx
│   │   │   ├── VUMeter.tsx
│   │   │   ├── Spectrum.tsx
│   │   │   └── index.ts
│   │   └── transport/            # Transport control components
│   │       ├── TransportButton.tsx
│   │       ├── PlaybackControls.tsx
│   │       └── index.ts
│   └── main.tsx                  # Import theme.css FIRST
```

---

## Phase 1: Inventory Existing Themes (READ BEFORE WRITE)

### Step 1.1: Scan for Old Color Systems

```bash
# Find all color/theme references in codebase
grep -r "color:\s*['\"]#" ~/Stable/packages --include="*.ts" --include="*.tsx" --include="*.css" | head -20
grep -r "const.*COLOR" ~/Stable/packages --include="*.ts" --include="*.tsx" | head -20
grep -r "tailwind" ~/Stable --include="*.config.*"
```

### Step 1.2: Identify Conflicts

**Look for:**
- Old `colors.ts` / `theme.ts` files
- Hardcoded hex values (`#C8FF1A`, `#000000`, etc.)
- Tailwind config with color definitions
- CSS-in-JS color objects (in React components)
- Storybook theme configurations

### Step 1.3: Create Backups

```bash
# Full monorepo backup before changes
cd ~/Stable
git status  # Verify clean state
git tag "pre-color-system-integration-$(date +%s)"
git branch "theme-migration-backup-$(date +%s)"
```

---

## Phase 2: Clean Installation

### Step 2.1: Copy Core Files (TypeScript)

**Destination:** `packages/shared/theme/`

```bash
mkdir -p ~/Stable/packages/shared/theme
```

**File 1: `colors.ts`** (Core color tokens)
- Copy `/mnt/user-data/uploads/r3-colors.ts`
- Verify: No `any` types, all colors are `const as const`
- Update import: `hexToRgba` is internal (no external deps)

**File 2: `audio.ts`** (DAW colors)
- Copy `/mnt/user-data/uploads/r3-audio-colors.ts`
- Update imports: `import { R3_COLORS, R3_COLORS_RGB, hexToRgba } from './colors';`

**File 3: `types.ts`** (TypeScript definitions)

```typescript
// packages/shared/theme/types.ts
/**
 * R3 Native — Type Definitions
 * Comprehensive types for color system, ensuring type safety across DAW
 */

import { R3_COLORS, R3_AUDIO_COLORS, R3_GRADIENTS } from './colors';
import { R3_WAVEFORMS, R3_SPECTRUM, R3_VU_METER } from './audio';

// Extract literal types from color objects
export type ColorKey = keyof typeof R3_COLORS;
export type AudioColorKey = keyof typeof R3_WAVEFORMS;
export type GradientKey = keyof typeof R3_GRADIENTS;
export type SpectrumType = 'default' | 'aggressive' | 'warm' | 'cool';

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'premium' | 'danger' | 'sale';

// Card variants
export type CardVariant = 'default' | 'premium';

// Badge types
export type BadgeType = 'success' | 'warning' | 'error' | 'premium' | 'info';

// Audio component props
export interface WaveformProps {
  trackType: AudioColorKey;
  width?: number;
  height?: number;
  animate?: boolean;
}

export interface VUMeterProps {
  level: number; // 0-1 normalized
  width?: number;
  height?: number;
}

export interface SpectrumProps {
  frequencyData?: Uint8Array;
  width?: number;
  height?: number;
  type?: SpectrumType;
}

// Export all color objects for re-export
export { R3_COLORS, R3_COLORS_RGB, R3_GLOWS, R3_GRADIENTS } from './colors';
export { R3_WAVEFORMS, R3_SPECTRUM, R3_VU_METER, R3_TRANSPORT, R3_CLIPPING } from './audio';
```

**File 4: `index.ts`** (Barrel export)

```typescript
// packages/shared/theme/index.ts
/**
 * R3 Native — Theme System Barrel Export
 * Single import point for all color, type, and utility exports
 * Usage: import { R3_COLORS, R3_WAVEFORMS } from '@shared/theme';
 */

// Core colors
export {
  R3_COLORS,
  R3_COLORS_RGB,
  R3_GLOWS,
  R3_GRADIENTS,
  R3_BUTTON_STYLES,
  R3_CARD_STYLE,
  R3_TYPOGRAPHY,
  R3_ICON_COLORS,
  hexToRgb,
  hexToRgba,
  applyCanvasGlow,
  createCanvasGradient,
} from './colors';

// Audio colors
export {
  R3_WAVEFORMS,
  R3_SPECTRUM,
  R3_VU_METER,
  R3_TRANSPORT,
  R3_CLIPPING,
  R3_FREQUENCY_BANDS,
  R3_AUTOMATION,
  R3_CLIP_COLORS,
  R3_MIXER_CHANNELS,
  createSpectrumGradient,
  getWaveformColor,
  getMixerChannelColor,
  interpolateColor,
  getRGBArray,
} from './audio';

// Types
export type {
  ColorKey,
  AudioColorKey,
  GradientKey,
  SpectrumType,
  ButtonVariant,
  CardVariant,
  BadgeType,
  WaveformProps,
  VUMeterProps,
  SpectrumProps,
} from './types';
```

### Step 2.2: Copy CSS Files

**Destination:** `apps/client/src/styles/`

```bash
mkdir -p ~/Stable/apps/client/src/styles
```

**File 1: `theme.css`** (Custom properties)
- Copy `/mnt/user-data/uploads/r3-theme.css`
- Add vendor prefixes for older browsers (optional, but good practice)
- No changes needed — already production-ready

**File 2: `utilities.css`** (Component utility classes)
- Copy button/card/badge classes from `r3-theme.css` sections
- Keep separate for maintainability
- File size ~200 lines

**File 3: `reset.css`** (Normalize + R3 defaults)

```css
/* apps/client/src/styles/reset.css */
/**
 * R3 Native — Global Reset & Defaults
 * Normalizes browser defaults and applies R3 theme baseline
 */

/* Normalize */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--r3-midnight-black);
  color: var(--r3-text-body);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  letter-spacing: 0.3px;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  padding: 0;
  margin: 0;
}

input,
textarea,
select {
  font-family: inherit;
  color: inherit;
}

a {
  color: var(--r3-neon-green);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--r3-text-headline);
}

code,
pre {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  background-color: var(--r3-graphite);
  border-radius: var(--r3-radius-md);
  padding: 2px 6px;
  font-size: 0.9em;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--r3-midnight-black);
}

::-webkit-scrollbar-thumb {
  background: var(--r3-graphite);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--r3-steel-gray);
}
```

**File 4: `index.css`** (Main entry point)

```css
/* apps/client/src/styles/index.css */
/**
 * R3 Native — Global Styles Entry Point
 * Import order matters: reset → theme → utilities
 */

@import './reset.css';
@import './theme.css';
@import './utilities.css';
```

### Step 2.3: Remove Old Color Systems

**WIRE Protocol: Dry-run first**

```bash
# Identify all files referencing old colors
cd ~/Stable

# Dry-run: Show what would be deleted
git grep -l "color" -- packages/shared apps/client | grep -E "(color|theme)" | head -10

# Create list of files to check
git grep -l "#C8FF1A\|#000000\|old.*color" -- "*.ts" "*.tsx" | tee /tmp/old_colors.txt
```

**Remove old color files (one-by-one, git tracked):**

```bash
# Example: if old file exists
git rm packages/shared/legacy/colors.ts 2>/dev/null || echo "No legacy file found"

# Remove hardcoded colors from imports in components (next phase)
# DO NOT delete yet — update phase handles this
```

---

## Phase 3: TypeScript Setup (Path Aliases)

### Step 3.1: Verify `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/theme": ["../../packages/shared/theme/index.ts"],
      "@shared/*": ["../../packages/shared/*"]
    }
  }
}
```

### Step 3.2: Test Import Resolution

```bash
cd ~/Stable/apps/client
pnpm tsc --noEmit  # Should pass with no errors
```

---

## Phase 4: Component Integration (No Breaking Changes)

### Step 4.1: Create Design System Components

**Destination:** `apps/client/src/components/ui/`

```bash
mkdir -p ~/Stable/apps/client/src/components/ui
mkdir -p ~/Stable/apps/client/src/components/audio
```

**File: `Button.tsx`**

```typescript
// apps/client/src/components/ui/Button.tsx
/**
 * R3 Native — Primary Button Component
 * CLAUDE.md compliant: No Redux, no console.log, typed React
 */

import React from 'react';
import { R3_COLORS, R3_GLOWS, hexToRgba } from '@shared/theme';
import type { ButtonVariant } from '@shared/theme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const getVariantStyles = (): React.CSSProperties => {
    const variants: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: R3_COLORS.midnightBlack,
        border: `1px solid ${R3_COLORS.neonGreen}`,
        color: R3_COLORS.neonGreen,
        boxShadow: `0 0 20px ${R3_GLOWS.accentGlowSoft}`,
      },
      secondary: {
        backgroundColor: R3_COLORS.graphite,
        border: `1px solid ${R3_COLORS.graphite}`,
        color: R3_COLORS.pureWhite,
      },
      premium: {
        backgroundColor: R3_COLORS.midnightBlack,
        border: `1px solid ${R3_COLORS.cyberPurple}`,
        color: R3_COLORS.cyberPurple,
        boxShadow: `0 0 20px ${R3_GLOWS.primaryGlow}`,
      },
      danger: {
        backgroundColor: R3_COLORS.record,
        border: `1px solid ${R3_COLORS.record}`,
        color: R3_COLORS.pureWhite,
      },
      sale: {
        backgroundColor: R3_COLORS.midnightBlack,
        border: `1px solid ${R3_COLORS.orangePromo}`,
        color: R3_COLORS.orangePromo,
        boxShadow: `0 0 20px ${R3_GLOWS.orangeGlow}`,
      },
    };
    return variants[variant];
  };

  const getSizeStyles = (): React.CSSProperties => {
    const sizes: Record<string, React.CSSProperties> = {
      sm: { padding: '8px 16px', fontSize: '0.875rem' },
      md: { padding: '12px 24px', fontSize: '1rem' },
      lg: { padding: '16px 32px', fontSize: '1.125rem' },
    };
    return sizes[size];
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        borderRadius: 'var(--r3-radius-lg)',
        fontWeight: 600,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled || isLoading ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          const btn = e.currentTarget;
          if (variant === 'primary') {
            btn.style.boxShadow = `0 0 30px ${R3_GLOWS.accentGlow}`;
            btn.style.backgroundColor = hexToRgba(R3_COLORS.neonGreen, 0.05);
          } else if (variant === 'premium') {
            btn.style.boxShadow = `0 0 30px ${R3_GLOWS.primaryGlow}`;
            btn.style.backgroundColor = hexToRgba(R3_COLORS.cyberPurple, 0.05);
          }
        }
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.boxShadow = getVariantStyles().boxShadow || 'none';
        btn.style.backgroundColor = getVariantStyles().backgroundColor || '';
      }}
      {...props}
    >
      {isLoading ? '…' : children}
    </button>
  );
}
```

**Similar files needed:**
- `Card.tsx` (container component)
- `Badge.tsx` (status indicator)
- Audio components: `Waveform.tsx`, `VUMeter.tsx`, `Spectrum.tsx`
- Transport: `TransportButton.tsx`, `PlaybackControls.tsx`

---

## Phase 5: Main.tsx Integration (CSS FIRST)

**File:** `apps/client/src/main.tsx`

```typescript
// apps/client/src/main.tsx
/**
 * R3 Native — Application Entry Point
 * CRITICAL: Import styles BEFORE React app to ensure CSS custom properties are loaded
 */

// ✅ MUST BE FIRST — Global CSS custom properties
import './styles/index.css';

// React
import React from 'react';
import ReactDOM from 'react-dom/client';

// App
import App from './App';

// Mount app
const root = document.getElementById('root');
if (!root) throw new Error('No root element found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Phase 6: Validation & Testing

### Step 6.1: TypeScript Compilation

```bash
cd ~/Stable
pnpm tsc --noEmit
# Should pass with 0 errors
```

### Step 6.2: Run Existing Tests

```bash
cd ~/Stable
pnpm test
# Ensure no regressions
```

### Step 6.3: Visual Verification

1. Open DevTools → Elements
2. Check `<root>` element has CSS custom properties: `--r3-neon-green`, `--r3-midnight-black`, etc.
3. Test color in console:
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--r3-neon-green')
   // Should return: " #B7FF00"
   ```

### Step 6.4: Component Storybook (Optional)

Create a Storybook story to visualize all colors, buttons, cards:

```typescript
// apps/client/src/components/ui/Button.stories.tsx
import { Button } from './Button';
import type { ButtonVariant } from '@shared/theme';

const variants: ButtonVariant[] = ['primary', 'secondary', 'premium', 'danger', 'sale'];

export default {
  title: 'UI/Button',
  component: Button,
};

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
    {variants.map((v) => (
      <Button key={v} variant={v}>
        {v}
      </Button>
    ))}
  </div>
);
```

---

## Phase 7: Migration Checklist (WIRE Protocol)

### Pre-Execution
- [ ] Create git backup: `git tag "pre-color-system-$(date +%s)"`
- [ ] Scan for old color systems: `grep -r "#" packages/shared apps/client | grep -i color`
- [ ] Read this doc 2x (WIRE: read-before-write)
- [ ] Dry-run all bash commands with `--dry-run` or check flags

### Execution
- [ ] Create `packages/shared/theme/` directory
- [ ] Copy TypeScript files (colors.ts, audio.ts, types.ts, index.ts)
- [ ] Copy CSS files (theme.css, utilities.css, reset.css, index.css)
- [ ] Update `apps/client/src/styles/` imports
- [ ] Update `apps/client/src/main.tsx` with CSS import
- [ ] Verify `tsconfig.json` path aliases
- [ ] Run `pnpm tsc --noEmit` ← Must pass
- [ ] Run `pnpm test` ← Must pass
- [ ] Create design system components (Button, Card, Badge)
- [ ] Test in browser: DevTools → Elements → root styles

### Post-Execution
- [ ] Commit: `git commit -m "feat: integrate R3 Native color system (replaces old themes)"`
- [ ] Tag: `git tag "color-system-v1.0"`
- [ ] Push to main: `git push origin main`
- [ ] Update CLAUDE.md: Document new import patterns for team

---

## Import Patterns (for reference)

### ✅ DO THIS

```typescript
// Single import for all colors
import { R3_COLORS, R3_WAVEFORMS, R3_GLOWS } from '@shared/theme';

// Use CSS custom properties
<div style={{ backgroundColor: 'var(--r3-midnight-black)' }} />

// Use utility classes
<button className="r3-btn-primary">Click</button>
```

### ❌ DON'T DO THIS

```typescript
// ❌ Hardcoded hex values
color: '#C8FF1A'

// ❌ Old theme imports
import { colors } from '@/legacy/theme'

// ❌ Inline color logic
const color = isActive ? '#B7FF00' : '#000000'
```

---

## Rollback Plan

If something breaks:

```bash
# Restore from backup tag
git checkout pre-color-system-TIMESTAMP

# Or from branch
git checkout theme-migration-backup-TIMESTAMP
```

---

## Success Criteria

✅ **All tests pass**  
✅ **TypeScript: 0 errors**  
✅ **CSS custom properties load in browser**  
✅ **All components render with R3 colors**  
✅ **No hardcoded color values remaining**  
✅ **Single import point: `@shared/theme`**  
✅ **CLAUDE.md governance upheld (no any, no console.log)**  
✅ **WIRE protocol followed (read, backup, dry-run, apply)**

---

**Ready to execute. Follow WIRE protocol. Ask before applying.**
