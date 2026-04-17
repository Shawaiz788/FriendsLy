# FriendsLy Module Map

This project is reorganized to reflect the architecture modules from the SRS and diagram while preserving existing routes, API contracts, and behavior.

## Frontend Modules (`src/modules`)

- `auth`
  - Responsibility: login, signup, and onboarding flows.
  - Paths:
    - `src/modules/auth/pages/Welcome.tsx`
    - `src/modules/auth/pages/Login.tsx`
    - `src/modules/auth/pages/SignUp.tsx`

- `user-account`
  - Responsibility: profile, settings, user account details.
  - Paths:
    - `src/modules/user-account/pages/ProfilePage.tsx`
    - `src/modules/user-account/pages/SettingsPage.tsx`
    - `src/modules/user-account/pages/UserProfilePage.tsx`
    - `src/modules/user-account/services/userAccountApi.ts`

- `intent-aura`
  - Responsibility: user aura/intent features.
  - Paths:
    - `src/modules/intent-aura/pages/IntentPage.tsx`
    - `src/modules/intent-aura/components/IntentBadge.tsx`
    - `src/modules/intent-aura/components/RadiusRing.tsx`

- `location-suggestion`
  - Responsibility: friend proximity and location suggestions.
  - Paths:
    - `src/modules/location-suggestion/pages/HomePage.tsx`
    - `src/modules/location-suggestion/components/ProximityMap.tsx`
    - `src/modules/location-suggestion/components/SuggestionCard.tsx`
    - `src/modules/location-suggestion/services/locationApi.ts`

- `friends-interaction`
  - Responsibility: friend discovery, requests, and relationships.
  - Paths:
    - `src/modules/friends-interaction/pages/FriendsPage.tsx`
    - `src/modules/friends-interaction/pages/SearchPage.tsx`
    - `src/modules/friends-interaction/components/FriendCard.tsx`
    - `src/modules/friends-interaction/services/friendsApi.ts`

- `content-creation`
  - Responsibility: social/content creation and interaction page.
  - Paths:
    - `src/modules/content-creation/pages/SocialPage.tsx`

- `safety-emergency`
  - Responsibility: notifications and alerting views.
  - Paths:
    - `src/modules/safety-emergency/pages/NotificationsPage.tsx`

- `shared`
  - Responsibility: cross-module navigation/shared feature UI.
  - Paths:
    - `src/modules/shared/navigation/BottomNav.tsx`
    - `src/modules/shared/navigation/NavLink.tsx`

- `core`
  - Responsibility: app fallback pages.
  - Paths:
    - `src/modules/core/pages/NotFound.tsx`
    - `src/modules/core/pages/Index.tsx`

## Backend Modules (`backend/src/modules`)

- `user-management`
  - Responsibility: account management, profile, friendships, location APIs.
  - Paths:
    - `backend/src/modules/user-management/controllers/UserController.js`
    - `backend/src/modules/user-management/routes/user.js`

## Compatibility Layer

- Existing imports from `src/components/*` are preserved via bridge re-exports.
- Existing imports from `src/lib/api.ts` are preserved through a barrel that re-exports module service APIs.

## Entry Points Updated

- Frontend routing imports updated in `src/App.tsx` to load module pages directly.
- Backend module imports updated in `backend/src/index.js`.

## Module Governance Rules

- All future frontend feature work must stay inside `src/modules/<parent-module>`.
- All future backend feature work must stay inside `backend/src/modules/<parent-module>`.
- New submodules are allowed, but each submodule must be explicitly linked to its parent module by:
  - Folder placement under the parent module path.
  - Imports/exports that resolve through the parent module boundary.
  - Updating this module map with the parent -> submodule relationship.
