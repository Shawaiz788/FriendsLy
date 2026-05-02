# Aura Visual Customization (FR12)

This feature allows users to customize the visual appearance of their Social Aura with color, emoji, and glow effects. All preferences are stored locally in browser localStorage without any Supabase synchronization.

## Components

### 1. **auraPreferences.ts** (Service)
Located in: `src/modules/intent-aura/services/auraPreferences.ts`

Manages local storage for Aura preferences:
- **Interface**: `AuraPreferences` with properties:
  - `color`: Hex color code (e.g., "#8b5cf6")
  - `emoji`: Unicode emoji string (e.g., "✨")
  - `glow`: Effect intensity ("none" | "subtle" | "medium" | "strong")

- **Constants**:
  - `AURA_COLORS`: 10 predefined color options (Violet, Blue, Cyan, etc.)
  - `AURA_EMOJIS`: 24 emoji options (stars, sparkles, elements, flowers, etc.)
  - `GLOW_OPTIONS`: 4 glow levels
  - `DEFAULT_AURA_PREFERENCES`: Violet color, sparkle emoji, medium glow

- **Functions**:
  - `loadAuraPreferences()`: Load from localStorage or return defaults
  - `saveAuraPreferences(prefs)`: Save to localStorage
  - `getGlowStyles(glow, color)`: Generate CSS box-shadow for glow effect

### 2. **AuraCustomizer.tsx** (Component)
Located in: `src/modules/intent-aura/components/AuraCustomizer.tsx`

UI component for customizing Aura appearance:
- **Features**:
  - Live preview of emoji with selected color and glow
  - Color palette selector (5 columns, 10 colors)
  - Emoji grid picker (scrollable, 6 columns)
  - Glow effect dropdown selector
  - Save button to persist changes

- **Usage**:
  ```tsx
  import AuraCustomizer from "@/modules/intent-aura/components/AuraCustomizer";
  
  <AuraCustomizer />
  ```

### 3. **useAuraPreferences.ts** (Hook)
Located in: `src/hooks/useAuraPreferences.ts`

Custom React hook for accessing Aura preferences throughout the app:
- **Returns**: `{ auraPreferences, updateAuraPreferences }`
- **Features**:
  - Loads preferences on mount
  - Listens to localStorage changes from other tabs
  - Provides function to update preferences

- **Usage**:
  ```tsx
  const { auraPreferences, updateAuraPreferences } = useAuraPreferences();
  ```

### 4. **AuraDisplay.tsx** (Component)
Located in: `src/components/AuraDisplay.tsx`

Reusable component for displaying the customized Aura across the app:
- **Props**:
  - `size`: "small" | "medium" | "large" (defaults to "medium")
  - `showLabel`: boolean (defaults to false)
  - `label`: string (optional)

- **Features**:
  - Applies customized color, emoji, and glow
  - Responsive sizing
  - Optional label display

- **Usage**:
  ```tsx
  import AuraDisplay from "@/components/AuraDisplay";
  
  <AuraDisplay size="large" showLabel label="My Aura" />
  ```

## Storage

All preferences are stored in localStorage under the key: **"friendsly.auraPreferences"**

```json
{
  "color": "#8b5cf6",
  "emoji": "✨",
  "glow": "medium"
}
```

## Integration

### Customization UI
The `AuraCustomizer` component is integrated into the **Intent & Aura** page (`IntentPage.tsx`) and appears at the top of the page for easy access.

### Map Display
- **ProximityMap Component** (`src/modules/location-suggestion/components/ProximityMap.tsx`):
  - The **outer radius circle is colored with your Aura color** (replaces the default green dashed circle)
  - User marker includes emoji badge at bottom-right showing their Aura emoji
  - Badge is positioned properly with white background and colored border matching Aura color

### Friend Markers
- Friend profile pictures display with Aura emoji badge in bottom-right corner
- Emoji badges have small colored borders matching the friend's presence status (nearby/city/away)
- Currently using generated consistent emojis per friend (can be extended with backend data)

### Friend Cards
- Optional `auraEmoji` prop displays Aura emoji badge on friend avatars
- Badge appears as small white circle with emoji in bottom-right corner of profile picture

## How to Test

1. Navigate to **Intent & Aura** page
2. Customize your Aura (select color, emoji)
3. Click **Save Aura Customization**
4. Go to **Home/Map** page
5. Observe:
   - Your user marker has the emoji badge at the bottom-right
   - The outer radius circle (max distance ring) is colored with your selected Aura color
   - Friend markers display emoji badges in bottom-right corners

## Future Enhancements

- Sync Aura preferences to Supabase for multi-device consistency
- Add animations when switching glow levels
- Create presets for quick Aura theme selection
- Display user's Aura in chat headers or user profiles
- Implement friend-to-friend Aura customization (currently using generated emojis)
- Add Aura animations (pulse, shimmer effects)
