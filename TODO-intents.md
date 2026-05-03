# Multiple Intents Implementation Plan

## Current Status
✅ Debug errors fixed
✅ Ready for intent system refactor

## Step 1: [PENDING] Update intentPreferences.ts interface
- Change `activeIntent: string` → `activeIntents: string[]`
- Update DEFAULT, load/save functions

## Step 2: [PENDING] Update HomePage.tsx
- Remove enabledIntents state/filter
- Show ALL intents always
- Toggle logic: click to add/remove from activeIntents[]
- UI shows multiple active badges highlighted

## Step 3: [PENDING] Update intentPreferencesApi.ts
- Send `active_intents: string[]` instead of active_intent

## Step 4: [PENDING] Update UserController.js
- Change `active_intent` string → `active_intents` array
- Update validation, DB upsert
- Backwards compatible with existing data

## Step 5: [PENDING] Test
- Multiple intents toggle
- Persist to backend/localStorage
- UI shows all intents, highlights active ones

Approve to proceed?

